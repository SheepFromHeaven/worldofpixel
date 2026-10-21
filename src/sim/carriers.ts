import {
  acceptedItems,
  demandFor,
  depositHopper,
  drawFromGround,
  groundRoom,
  inputStock,
  onTheLine,
  dropSpace,
  isStore,
  outputPressure,
  outputStock,
  storedStock,
  supplies,
  withdraw,
} from './buildings.ts';
import { distance } from './geometry.ts';
import { bedsIn, canHaul } from './needs.ts';
import { cellNode, paceAt, positionOf, routeNodes, stepOn } from './footpaths.ts';
import type { NodeId } from './footpaths.ts';
import { approachTo } from './zones.ts';
import { landWorkById, paceOf } from './landWorks.ts';
import { methodById } from './book.ts';
import type { Book } from './book.ts';
import { scanQueue } from './process.ts';
import { PARCEL } from './parcels.ts';
import { BuildingState, CarrierState } from './types.ts';
import type {
  Building,
  BuildingId,
  Carrier,
  CarrierId,
  ItemType,
  Job,
  Settlement,
  TickEvent,
} from './types.ts';
import type { GameWorld } from './world.ts';

/**
 * World units a carrier covers in a tick. A parcel is about 3.8 across and a tick is a tenth of
 * a second at normal speed, so this is a walk of roughly a parcel and a half a second — people
 * carrying things on their backs, not errand-runners sprinting between doors.
 */
export const CARRIER_SPEED = 0.6;
export const HANDLING_TICKS = 2;
/** Ticks a carrier will wait at a full hopper before it goes looking for another taker. */
export const STALL_LIMIT = 8;

/**
 * A town is as big as the beds it has built.
 *
 * It used to grow with the number of buildings, which made a village of sheds staff itself: the
 * town's size was a consequence of its floor space rather than a thing anybody decided. Beds are
 * the honest measure — a lean-to is two more people, a hut three, a clay house five — and they
 * make the shelter ladder the chapter's population curve instead of a convenience.
 */
export function staffSettlement(settlement: Settlement): number {
  const hearth = settlement.buildings.get(settlement.hearthId);
  if (!hearth) return 0;

  const wanted = bedsIn(settlement);
  let hired = 0;
  for (let index = settlement.carriers.size; index < wanted; index += 1) {
    const carrier = createCarrier(`${settlement.id}/carrier-${index + 1}`, hearth);
    settlement.carriers.set(carrier.id, carrier);
    hired += 1;
  }
  return hired;
}

export function createCarrier(id: CarrierId, home: Building): Carrier {
  return {
    id,
    position: { ...home.position },
    carryingItem: null,
    state: CarrierState.Idle,
    homeId: home.id,
    job: null,
    trail: [],
    handling: 0,
    left: 0,
    walked: 0,
    heading: { x: 1, y: 0 },
    atId: home.id,
  };
}

/**
 * What other carriers have already spoken for. Recomputed from the carriers themselves every
 * dispatch rather than kept as a ledger: a stale reservation is the one bug in this whole layer
 * that would be invisible — the item never moves and nothing reports an error.
 */
export interface Claims {
  /** Units promised out of a building's output buffer. */
  outgoing: Map<BuildingId, number>;
  /** Units already walking toward a building's hopper, keyed `buildingId|item`. */
  incoming: Map<string, number>;
}

const incomingKey = (buildingId: BuildingId, item: ItemType): string => `${buildingId}|${item}`;

export function collectClaims(settlement: Settlement): Claims {
  const outgoing = new Map<BuildingId, number>();
  const incoming = new Map<string, number>();

  for (const carrier of settlement.carriers.values()) {
    const job = carrier.job;
    // Only a haul promises anything out of a crate or into a door: a shift draws what is not
    // stock yet, and clearing moves nothing at all.
    if (!job || job.kind !== 'haul') continue;
    if (carrier.carryingItem === null) {
      outgoing.set(job.sourceId, (outgoing.get(job.sourceId) ?? 0) + 1);
    }
    const key = incomingKey(job.destinationId, job.item);
    incoming.set(key, (incoming.get(key) ?? 0) + 1);
  }

  return { outgoing, incoming };
}

/**
 * What can be taken out of a building for a given errand. A *store's* bin feeds the workshops
 * but never another store: without that rule a load would shuttle for ever between two
 * warehouses, each taking it in because nobody else wanted it.
 *
 * A works' bin is not that. It is the crate its rig unloads into, and the fire is the one place
 * a basket is ever wanted — read as a warehouse, the baskets stood in the weaving frame and the
 * town never sealed one.
 */
function availableSupply(
  building: Building,
  item: ItemType,
  claims: Claims,
  toStore: boolean,
): number {
  const shelved = toStore && isStore(building) ? 0 : storedStock(building, item);
  const stock = outputStock(building, item) + shelved;
  return stock - (claims.outgoing.get(building.id) ?? 0);
}

function availableSpace(building: Building, item: ItemType, claims: Claims): number {
  return dropSpace(building, item) - (claims.incoming.get(incomingKey(building.id, item)) ?? 0);
}

interface Want {
  item: ItemType;
  /** How short of a full batch this hopper is, as a fraction — lowest is fetched first. */
  fill: number;
  order: number;
}

/** What the methods on this building's rig ask for in one pass down its queue. */
function rigDemand(building: Building, book: Book, item: ItemType): number {
  let demand = 0;
  for (const id of building.rig?.queue ?? []) {
    for (const input of methodById(book, id)?.inputs ?? []) {
      if (input.item === item) demand += input.amount;
    }
  }
  return demand;
}

/**
 * Whether this is a load the building's own rig is waiting on.
 *
 * The fire is the town's store and a rig at once, and what it is *waiting on* is not a last
 * resort: a basket and its daub are wanted at the hearth exactly the way clay is wanted at a
 * kiln. Read as a warehouse's shelf instead, they were offered only once nothing else in town
 * wanted a load — and with a cord walk and a weaving frame both backed up, that never happened.
 */
function rigWants(building: Building, book: Book, item: ItemType): boolean {
  return rigDemand(building, book, item) > 0;
}

/**
 * How far ahead a rig is stocked: the batch it is working, and one waiting behind it.
 *
 * It asks for that and no further. A fire that went on asking for baskets after it had the one
 * it was drying filled the town's own bins with them, and then had nowhere to stand the vessel.
 */
const BATCHES_AHEAD = 2;

/** Which of a building's wants belong to this pass: its own work first, its shelves last. */
function wantsIn(building: Building, settlement: Settlement, claims: Claims, stores: boolean): Want[] {
  const shelf = isStore(building);
  const wants: Want[] = [];
  for (const want of wantsOf(building, settlement, claims)) {
    const mine = rigWants(building, settlement.book, want.item);
    if (mine && want.fill >= BATCHES_AHEAD) continue;
    if ((shelf && !mine) !== stores) continue;
    wants.push(want);
  }
  return wants;
}

/**
 * What a building is short of, and how short.
 *
 * `held` counts the bins as well as the doors, which it did not: a rig takes its batch out of
 * either (`heldFor`), and a hearth with eight bins of wood standing in it read as empty and went
 * on asking for wood until there was nowhere left to put a basket. `needed` counts what the
 * rig's own queue asks for as well as what a combine block does, for the same reason — the one
 * is as much a recipe as the other.
 */
function wantsOf(building: Building, settlement: Settlement, claims: Claims): Want[] {
  const wants: Want[] = [];

  acceptedItems(building).forEach((item, order) => {
    if (availableSpace(building, item, claims) <= 0) return;
    const held =
      inputStock(building, item) +
      storedStock(building, item) +
      (claims.incoming.get(incomingKey(building.id, item)) ?? 0);
    const needed = demandFor(building, item) + rigDemand(building, settlement.book, item) || 1;
    wants.push({ item, fill: held / needed, order });
  });

  return wants.sort((a, b) => a.fill - b.fill || a.order - b.order);
}

/**
 * The best job on offer, not the first one found. Scanning in order and taking the first match
 * starves whatever sits late in the list: the well always has water waiting, so the mixer at the
 * far end would never see a load of earth. Scoring instead lets a chain drain from the far end —
 *
 *   urgency  how empty the destination hopper is, measured against the batch it needs
 *   pressure how backed up the source is, so a full output block gets relieved first
 *   legs     a mild preference for the nearer of two equal suppliers
 *
 * The town store is the destination of last resort: an empty bin takes anything, so left to
 * compete it would swallow the water a mixer was waiting on. A store is only offered jobs once
 * nothing that *makes* something wants the load — a rule, rather than the thumb on the scale a
 * flat penalty was.
 *
 * Every tie breaks on insertion order, so the choice is reproducible rather than merely stable.
 */
/**
 * A mild preference for the nearer of two equal errands, per parcel of straight-line walk. Straight
 * line rather than the route: dispatch weighs every pair of buildings, and the route is found only
 * for the errand taken (`footpaths.ts`).
 */
const DISTANCE_PENALTY = 0.03;

/** Parcels apart, as the crow flies. */
const apart = (a: Building, b: Building): number => distance(a.position, b.position) / PARCEL;

/**
 * Pairs of buildings a walk between has been looked for and not found — across the sea, round the
 * far side of a lake too wide to go round — per town, forgotten whenever the town changes. Dispatch
 * takes every pair to be walkable until a walk is actually looked for and fails: looking ahead of
 * time meant laying out the ground for parcels round the whole town, a freeze on the first errand
 * of every game, for an answer that is nearly always yes.
 */
const unreachable = new Map<string, { revision: number; pairs: Set<string> }>();

function blocked(settlement: Settlement): Set<string> {
  let known = unreachable.get(settlement.id);
  if (!known || known.revision !== settlement.revision) {
    known = { revision: settlement.revision, pairs: new Set() };
    unreachable.set(settlement.id, known);
  }
  return known.pairs;
}

/**
 * The middle of every parcel a building stands on, which a walk may not step on: nobody walks
 * through a building. Derived from the buildings and kept per town until one goes up or comes
 * down, like `blocked` — a route is searched once per errand and would otherwise rebuild it.
 */
const indoors = new Map<string, { revision: number; nodes: Set<NodeId> }>();

function builtMiddles(settlement: Settlement): Set<NodeId> {
  let known = indoors.get(settlement.id);
  if (!known || known.revision !== settlement.revision) {
    known = { revision: settlement.revision, nodes: new Set() };
    for (const building of settlement.buildings.values()) known.nodes.add(cellNode(building.cellId));
    indoors.set(settlement.id, known);
  }
  return known.nodes;
}

/** Whether a building can be walked to from another, as far as anyone has found out yet. */
function reaches(settlement: Settlement, a: BuildingId, b: BuildingId): boolean {
  return a === b || !blocked(settlement).has(`${a}>${b}`);
}

/**
 * What is at a carrier's feet comes first. A villager who has just finished a shift is standing
 * at the crate it filled, and walking off to fetch something from across the town while that
 * crate sits full is the one choice nobody watching would understand: it comes out of the well
 * and carries the water away.
 */
const HERE_BONUS = 1;

/** A clear job carries nothing; its item is a placeholder the job type requires, and never read. */
const ITEM_NONE: ItemType = 'Dirt';

function bestJob(
  world: GameWorld,
  settlement: Settlement,
  carrier: Carrier,
  claims: Claims,
  stores: boolean,
): Job | null {
  let best: { job: Job; score: number } | null = null;

  // Who has each item to give, worked out once rather than for every destination that wants it.
  // Asked inside the loop, every building in town was weighed against every other on every
  // dispatch — a sixty-building town spent a millisecond and a half per idle carrier deciding
  // that most of them had nothing. Same buildings, same order, so the same job comes out.
  const suppliers = new Map<ItemType, Building[]>();
  const suppliersOf = (item: ItemType): Building[] => {
    let list = suppliers.get(item);
    if (!list) {
      list = [...settlement.buildings.values()].filter((source) => availableSupply(source, item, claims, stores) > 0);
      suppliers.set(item, list);
    }
    return list;
  };

  for (const destination of settlement.buildings.values()) {
    if (destination.clearing) continue;

    for (const want of wantsIn(destination, settlement, claims, stores)) {
      // Nobody carries water before there is something to carry it in (`needs.ts`).
      if (!canHaul(settlement, want.item)) continue;
      for (const source of suppliersOf(want.item)) {
        if (source.id === destination.id || source.clearing) continue;

        if (!reaches(settlement, carrier.atId, source.id) || !reaches(settlement, source.id, destination.id)) continue;
        const at = settlement.buildings.get(carrier.atId) ?? source;

        const urgency = Math.max(0, 1 - want.fill);
        const pressure = outputPressure(source, want.item);
        const walk = apart(at, source) + apart(source, destination);
        const here = source.id === carrier.atId ? HERE_BONUS : 0;
        const score = urgency + pressure + here - walk * DISTANCE_PENALTY;

        if (!best || score > best.score) {
          best = {
            job: { kind: 'haul', item: want.item, sourceId: source.id, destinationId: destination.id },
            score,
          };
        }
      }
    }
  }

  return best?.job ?? null;
}

/** Land works someone is already walking to or working. Derived from the carriers, like claims. */
function manned(settlement: Settlement): Set<BuildingId> {
  const sites = new Set<BuildingId>();
  for (const carrier of settlement.carriers.values()) {
    if (carrier.job?.kind === 'work') sites.add(carrier.job.sourceId);
  }
  return sites;
}

/** How many are already in each rig, so a kiln's second stoker can go in and a third cannot. */
function crewed(settlement: Settlement): Map<BuildingId, number> {
  const inside = new Map<BuildingId, number>();
  for (const carrier of settlement.carriers.values()) {
    if (carrier.job?.kind !== 'tend') continue;
    inside.set(carrier.job.sourceId, (inside.get(carrier.job.sourceId) ?? 0) + 1);
  }
  return inside;
}

/**
 * A shift at a rig: somebody has to stoke the fire and watch the pile.
 *
 * Scored like the others, by how short the rig is of hands and how far it is to walk, so the
 * fire the town is waiting on is tended before the one at the far end of the claim. Offered
 * only when the queue actually has something it can run — a villager standing in a kiln with
 * no clay is an hour of the day spent on nothing, and hours are the whole subject.
 */
function bestTend(world: GameWorld, settlement: Settlement, carrier: Carrier): Job | null {
  const inside = crewed(settlement);
  const at = settlement.buildings.get(carrier.atId);
  let best: { job: Job; score: number } | null = null;

  for (const building of settlement.buildings.values()) {
    const rig = building.rig;
    if (!rig || building.clearing || building.retooling > 0) continue;
    if ((inside.get(building.id) ?? 0) >= rig.crew.max) continue;
    if (!rig.running && !scanQueue(rig, settlement.book, building).method) continue;
    if (!reaches(settlement, carrier.atId, building.id)) continue;

    const walk = at ? apart(at, building) : 0;
    const short = (inside.get(building.id) ?? 0) < rig.crew.min ? 1 : 0;
    const score = short - walk * DISTANCE_PENALTY;
    if (!best || score > best.score) {
      best = { job: { kind: 'tend', item: ITEM_NONE, sourceId: building.id, destinationId: building.id }, score };
    }
  }

  return best?.job ?? null;
}

/**
 * The best shift on offer: a land work nobody is on, with room in its crate for a whole batch,
 * whose item somebody wants. Scored like a haul — how short the taker is, less the walk there and
 * on to the taker — so a villager goes to work the well a mixer is waiting on before the one at
 * the far end of town.
 */
function bestWork(world: GameWorld, settlement: Settlement, carrier: Carrier, claims: Claims, stores: boolean): Job | null {
  const busy = manned(settlement);
  let best: { job: Job; score: number } | null = null;

  // What each taker wants, worked out once. Asked afresh for every land work it was weighed
  // against, a sixty-building town recomputed it two and a half thousand times a dispatch, and
  // shifts were most of what dispatch cost.
  const wants = new Map<BuildingId, Want[]>();
  const wantsAt = (destination: Building): Want[] => {
    let list = wants.get(destination.id);
    if (!list) {
      list = wantsIn(destination, settlement, claims, stores);
      wants.set(destination.id, list);
    }
    return list;
  };

  for (const site of settlement.buildings.values()) {
    const work = landWorkById(site.designId);
    if (!work || site.clearing || busy.has(site.id)) continue;
    if (!canHaul(settlement, work.item)) continue;
    if (!site.yields.includes(work.item) || groundRoom(site, work.item) < work.batch) continue;

    if (!reaches(settlement, carrier.atId, site.id)) continue;
    const at = settlement.buildings.get(carrier.atId) ?? site;

    for (const destination of settlement.buildings.values()) {
      if (destination.id === site.id || destination.clearing) continue;
      const want = wantsAt(destination).find((entry) => entry.item === work.item);
      if (!want) continue;
      if (!reaches(settlement, site.id, destination.id)) continue;

      const score = Math.max(0, 1 - want.fill) - (apart(at, site) + apart(site, destination)) * DISTANCE_PENALTY;
      if (!best || score > best.score) {
        best = { job: { kind: 'work', item: work.item, sourceId: site.id, destinationId: site.id }, score };
      }
    }
  }

  return best?.job ?? null;
}

/**
 * Haul for the workshops first, then make more — a shift at a rig, then a shift on the ground —
 * then haul to the stores, and fill them from the ground last. Moving what is already made
 * beats making more of it, and the town store, which takes anything, is last at both, or it
 * would soak up every hand the workshops need.
 *
 * A shift at a rig sits *under* the workshops' hauls for that reason and it has to: with a rig
 * on every other floor there is always one that can run, so tending offered first meant nothing
 * was ever carried while any fire in town would light — and a daub pit standing full of daub,
 * which nobody could tend because it was full, was never emptied either.
 */
/**
 * The nearest site waiting to be cleared that nobody is clearing yet. Clearing comes before every
 * other errand — a building placed and left standing in the trees is the one thing a player waits
 * on with nothing to watch — but one villager to a site, so a new building never empties the town
 * of hands.
 */
function bestClear(world: GameWorld, settlement: Settlement, carrier: Carrier): Job | null {
  const taken = new Set<BuildingId>();
  for (const other of settlement.carriers.values()) {
    if (other.job?.kind === 'clear') taken.add(other.job.sourceId);
  }
  const at = settlement.buildings.get(carrier.atId);
  let best: { job: Job; walk: number } | null = null;
  for (const site of settlement.buildings.values()) {
    if (!site.clearing || taken.has(site.id) || !reaches(settlement, carrier.atId, site.id)) continue;
    const walk = at ? apart(at, site) : 0;
    if (!best || walk < best.walk) {
      best = { job: { kind: 'clear', item: ITEM_NONE, sourceId: site.id, destinationId: site.id }, walk };
    }
  }
  return best?.job ?? null;
}

export function findJob(world: GameWorld, settlement: Settlement, carrier: Carrier, claims: Claims): Job | null {
  return (
    bestClear(world, settlement, carrier) ??
    bestJob(world, settlement, carrier, claims, false) ??
    bestTend(world, settlement, carrier) ??
    bestWork(world, settlement, carrier, claims, false) ??
    bestJob(world, settlement, carrier, claims, true) ??
    bestWork(world, settlement, carrier, claims, true)
  );
}

/**
 * Sets a carrier walking from where it stands to a building, across the ground (`footpaths.ts`).
 * False when there is no way there. The walk starts with the next node, not the one underfoot.
 */
function setOff(
  world: GameWorld,
  settlement: Settlement,
  carrier: Carrier,
  toId: BuildingId,
  dock?: { item: ItemType; role: 'give' | 'take' },
): boolean {
  const from = settlement.buildings.get(carrier.atId);
  const to = settlement.buildings.get(toId);
  if (!from || !to) return false;
  if (from.id === to.id) {
    carrier.trail = [];
    return true;
  }

  // Round to the door, not to the middle (`doors.ts`). The walk ends at the corner of the parcel
  // the door opens onto and steps in from there, so a load is carried to the side of the
  // building it is wanted on — and the path wears where it was walked.
  const start = cellNode(from.cellId);
  const middle = cellNode(to.cellId);
  const door = dock ? approachTo(world, to, dock.item, dock.role) : null;

  // The door first, and the middle if there is no walking to it. A corner can be cut off by
  // water or by a neighbour's ground even where the building itself is plainly reachable, and a
  // door nobody can reach must not make the whole pair of buildings look unwalkable — that
  // answer is remembered until the town changes, and it would strand the machine for good.
  // Round the buildings, and round this one to its door: every built parcel's middle is shut out
  // of the search, so the walk goes by the corners rather than through the masonry.
  const shut = builtMiddles(settlement);

  if (door) {
    const round = routeNodes(world, start, door, shut);
    if (round) {
      // **And it stops at the corner.** The walk used to step on into the middle afterwards,
      // which is a step into the building: the last thing a villager did on its way to the well
      // was walk over the shaft and stand in it. A load is handed in at the side it is wanted on,
      // and that is where the carrier stands while it is handing it in.
      carrier.trail = round.slice(1);
      return true;
    }
  }

  const walk = routeNodes(world, start, middle, shut);
  if (!walk) {
    blocked(settlement).add(`${from.id}>${to.id}`);
    return false;
  }
  carrier.trail = walk.slice(1);
  return true;
}

export function assignJob(world: GameWorld, settlement: Settlement, carrier: Carrier, job: Job): boolean {
  // A haul starts at the crate it collects from; a shift and a clearing are errands to the whole
  // site, which has no one square to walk to.
  const dock = job.kind === 'haul' ? ({ item: job.item, role: 'take' } as const) : undefined;
  if (!setOff(world, settlement, carrier, job.sourceId, dock)) return false;

  carrier.job = job;
  const there = carrier.trail.length === 0;
  if (job.kind === 'work' || job.kind === 'clear' || job.kind === 'tend') {
    if (there) arrive(settlement, carrier);
    else carrier.state = CarrierState.MovingToWork;
    return true;
  }
  carrier.state = there ? CarrierState.PickingUp : CarrierState.MovingToSource;
  carrier.handling = there ? HANDLING_TICKS : 0;
  return true;
}

/** At the site it walked to: in to work a shift, or out among the trees to clear it. */
function arrive(settlement: Settlement, carrier: Carrier): void {
  if (carrier.job?.kind === 'clear') carrier.state = CarrierState.Clearing;
  else if (carrier.job?.kind === 'tend') carrier.state = CarrierState.Working;
  else beginShift(settlement, carrier);
}

/** In through the door: off the map, with a batch to draw. */
function beginShift(settlement: Settlement, carrier: Carrier): void {
  const site = carrier.job ? settlement.buildings.get(carrier.job.sourceId) : undefined;
  const work = site ? landWorkById(site.designId) : undefined;
  if (!work) {
    carrier.state = CarrierState.Idle;
    carrier.job = null;
    return;
  }
  carrier.state = CarrierState.Working;
  carrier.left = work.batch;
  carrier.handling = paceOf(work);
}

/** Out again, empty-handed and standing at the crate it filled. */
function endShift(carrier: Carrier): void {
  carrier.state = CarrierState.Idle;
  carrier.job = null;
  carrier.left = 0;
  carrier.handling = 0;
}

/**
 * Only somebody *inside* a building stands at its middle.
 *
 * This pinned every carrier at a building to the parcel's middle, which is the inside of the
 * well's shaft and the middle of a works' floor. A villager that walked to a door stands at that
 * door; a worker on a shift is off the map in the building, and the middle is where it is.
 */
function syncPosition(settlement: Settlement, carrier: Carrier): void {
  if (carrier.trail.length > 0 || carrier.state !== CarrierState.Working) return;
  const standing = settlement.buildings.get(carrier.atId);
  if (standing) carrier.position = { ...standing.position };
}

/**
 * A tick of walking toward `toId`: as far as the ground lets it — quicker on a worn path, slower in
 * a wood or a marsh — stepping on each node it reaches, which is what wears the path. Returns true
 * on arriving, standing at the building.
 */
function walk(world: GameWorld, settlement: Settlement, carrier: Carrier, toId: BuildingId): boolean {
  let left = CARRIER_SPEED;
  while (left > 0 && carrier.trail.length > 0) {
    const next = carrier.trail[0]!;
    const target = positionOf(world, next);
    const pace = paceAt(world, next);
    const dx = target.x - carrier.position.x;
    const dy = target.y - carrier.position.y;
    const gap = Math.hypot(dx, dy);
    const reach = left * pace;
    if (gap > 0) carrier.heading = { x: dx / gap, y: dy / gap };
    if (gap > reach) {
      carrier.position = { x: carrier.position.x + (dx / gap) * reach, y: carrier.position.y + (dy / gap) * reach };
      carrier.walked += reach;
      return false;
    }
    carrier.position = target;
    carrier.walked += gap;
    left -= gap / pace;
    stepOn(world, next);
    carrier.trail.shift();
  }
  if (carrier.trail.length > 0) return false;

  carrier.atId = toId;
  syncPosition(settlement, carrier);
  return true;
}

function otherTakerFor(settlement: Settlement, item: ItemType, exclude: BuildingId): BuildingId | null {
  for (const building of settlement.buildings.values()) {
    if (building.id === exclude) continue;
    if (dropSpace(building, item) > 0) return building.id;
  }
  return null;
}

export function stepCarrier(world: GameWorld, settlement: Settlement, carrier: Carrier, tick: number): TickEvent[] {
  const events: TickEvent[] = [];
  const job = carrier.job;

  switch (carrier.state) {
    case CarrierState.Idle:
      syncPosition(settlement, carrier);
      break;

    case CarrierState.MovingToSource:
      if (job && walk(world, settlement, carrier, job.sourceId)) {
        carrier.state = CarrierState.PickingUp;
        carrier.handling = HANDLING_TICKS;
      }
      break;

    case CarrierState.PickingUp: {
      carrier.handling -= 1;
      if (carrier.handling > 0 || !job) break;
      const source = settlement.buildings.get(job.sourceId);
      const taken = source ? withdraw(source, job.item, 1) : 0;
      if (taken === 0) {
        carrier.state = CarrierState.Idle;
        carrier.job = null;
        break;
      }
      carrier.carryingItem = job.item;
      events.push({ tick, kind: 'pickup', carrierId: carrier.id, buildingId: job.sourceId, item: job.item });
      if (!setOff(world, settlement, carrier, job.destinationId, { item: job.item, role: 'give' })) {
        carrier.state = CarrierState.Idle;
        break;
      }
      carrier.state = carrier.trail.length === 0 ? CarrierState.DroppingOff : CarrierState.MovingToDest;
      carrier.handling = carrier.trail.length === 0 ? HANDLING_TICKS : 0;
      break;
    }

    case CarrierState.MovingToDest:
      if (job && walk(world, settlement, carrier, job.destinationId)) {
        carrier.state = CarrierState.DroppingOff;
        carrier.handling = HANDLING_TICKS;
      }
      break;

    case CarrierState.MovingToWork:
      if (job && walk(world, settlement, carrier, job.sourceId)) arrive(settlement, carrier);
      break;

    case CarrierState.Clearing: {
      // A tick of felling. Shared work: any number could clear one site, though dispatch sends one.
      const site = job ? settlement.buildings.get(job.sourceId) : undefined;
      if (!site?.clearing) {
        endShift(carrier);
        break;
      }
      site.clearing.done += 1;
      if (site.clearing.done >= site.clearing.needed) {
        site.clearing = null;
        site.state = BuildingState.Idle;
        events.push({ tick, kind: 'cleared', carrierId: carrier.id, buildingId: site.id });
        endShift(carrier);
      }
      break;
    }

    case CarrierState.Working: {
      const site = job ? settlement.buildings.get(job.sourceId) : undefined;

      // Tending a rig is a watch rather than a batch: the engine runs the rig while somebody is
      // in it, and they come out when the queue has nothing left it can work on. A stop
      // condition is what ends the shift, which is why every entry needs one.
      if (job?.kind === 'tend') {
        const rig = site?.rig;
        if (!site || !rig) {
          endShift(carrier);
          break;
        }
        if (!rig.running && rig.changeover === 0 && !scanQueue(rig, settlement.book, site).method) {
          endShift(carrier);
        }
        break;
      }

      // The batch is drawn: the shift is over once it is in the crate, not when the last unit
      // leaves the ground. Out any sooner and the villager stands at an empty crate with its own
      // load still on the belt behind it — and, finding nothing to carry, goes straight back in.
      if (carrier.left <= 0) {
        if (!site || !job || onTheLine(site, job.item) === 0) endShift(carrier);
        break;
      }

      carrier.handling -= 1;
      if (carrier.handling > 0 || !job) break;
      const work = site ? landWorkById(site.designId) : undefined;
      // A line backed up mid-shift — only an edit to the building can do that, since a shift is
      // offered only when the batch fits — ends the shift rather than leaving the villager inside.
      if (!site || !work || !drawFromGround(site, job.item)) {
        endShift(carrier);
        break;
      }
      events.push({ tick, kind: 'produced', carrierId: carrier.id, buildingId: site.id, item: job.item });
      carrier.left -= 1;
      carrier.handling = paceOf(work);
      break;
    }

    case CarrierState.DroppingOff: {
      carrier.handling -= 1;
      if (carrier.handling > 0) break;
      const item = carrier.carryingItem;
      const destination = job ? settlement.buildings.get(job.destinationId) : undefined;
      const placed = destination && item ? depositHopper(destination, item, 1) : 0;

      if (placed > 0 && item && destination) {
        events.push({ tick, kind: 'dropoff', carrierId: carrier.id, buildingId: destination.id, item });
        carrier.carryingItem = null;
        carrier.job = null;
        carrier.state = CarrierState.Idle;
        break;
      }

      // Hopper filled up while we walked. Wait a little, then take the load somewhere it fits —
      // a carrier that stands at a full door forever strands the item it is holding.
      carrier.handling = 1;
      carrier.walked += 1;
      if (carrier.walked % STALL_LIMIT === 0 && item && job) {
        const taker = otherTakerFor(settlement, item, job.destinationId);
        if (taker) {
          if (setOff(world, settlement, carrier, taker)) {
            carrier.job = { ...job, destinationId: taker };
            carrier.state = carrier.trail.length === 0 ? CarrierState.DroppingOff : CarrierState.MovingToDest;
            carrier.handling = carrier.trail.length === 0 ? HANDLING_TICKS : 0;
            break;
          }
        }
        events.push({
          tick,
          kind: 'stalled',
          carrierId: carrier.id,
          item,
          detail: `no taker for ${item}`,
        });
      }
      break;
    }
  }

  return events;
}
