import {
  acceptedItems,
  demandFor,
  depositHopper,
  drawFromGround,
  groundRoom,
  inputStock,
  onTheLine,
  hopperSpace,
  isStore,
  outputPressure,
  outputStock,
  storedStock,
  supplies,
  withdraw,
} from './buildings.ts';
import { pointAlongPath } from './geometry.ts';
import { landWorkById, paceOf } from './landWorks.ts';
import { otherEnd, routeBetween } from './paths.ts';
import { BuildingState, CarrierState } from './types.ts';
import type {
  Building,
  BuildingId,
  Carrier,
  CarrierId,
  ItemType,
  Job,
  PathId,
  Settlement,
  TickEvent,
} from './types.ts';

/**
 * World units a carrier covers in a tick. A parcel is about 3.8 across and a tick is a tenth of
 * a second at normal speed, so this is a walk of roughly a parcel and a half a second — people
 * carrying things on their backs, not errand-runners sprinting between doors.
 */
export const CARRIER_SPEED = 0.6;
export const HANDLING_TICKS = 2;
/** Ticks a carrier will wait at a full hopper before it goes looking for another taker. */
export const STALL_LIMIT = 8;

/** Two to begin with, and another for every pair of buildings after that, up to a crowd. */
export const CARRIERS_FOR = (buildings: number): number =>
  Math.max(2, Math.min(8, Math.floor(buildings / 2) + 1));

/**
 * Hire whoever the settlement is now short of. A town that grows without carriers looks broken
 * rather than busy: the buildings fill up, nothing moves, and nothing says why.
 */
export function staffSettlement(settlement: Settlement): number {
  const hearth = settlement.buildings.get(settlement.hearthId);
  if (!hearth) return 0;

  const wanted = CARRIERS_FOR(settlement.buildings.size);
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
    pathId: null,
    progress: 0,
    carryingItem: null,
    state: CarrierState.Idle,
    homeId: home.id,
    job: null,
    route: [],
    handling: 0,
    left: 0,
    walked: 0,
    heading: { x: 1, y: 0 },
    atId: home.id,
    direction: 1,
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
 * What can be taken out of a building for a given errand. A bin feeds the workshops but never
 * another store: without that rule a load would shuttle for ever between two warehouses, each
 * taking it in because nobody else wanted it.
 */
function availableSupply(
  building: Building,
  item: ItemType,
  claims: Claims,
  toStore: boolean,
): number {
  const stock = outputStock(building, item) + (toStore ? 0 : storedStock(building, item));
  return stock - (claims.outgoing.get(building.id) ?? 0);
}

function availableSpace(building: Building, item: ItemType, claims: Claims): number {
  return hopperSpace(building, item) - (claims.incoming.get(incomingKey(building.id, item)) ?? 0);
}

interface Want {
  item: ItemType;
  /** How short of a full batch this hopper is, as a fraction — lowest is fetched first. */
  fill: number;
  order: number;
}

function wantsOf(building: Building, claims: Claims): Want[] {
  const wants: Want[] = [];

  acceptedItems(building).forEach((item, order) => {
    if (availableSpace(building, item, claims) <= 0) return;
    const held =
      inputStock(building, item) +
      (claims.incoming.get(incomingKey(building.id, item)) ?? 0);
    const needed = demandFor(building, item) || 1;
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
const LEG_PENALTY = 0.1;

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
    if (destination.clearing || isStore(destination) !== stores) continue;

    for (const want of wantsOf(destination, claims)) {
      for (const source of suppliersOf(want.item)) {
        if (source.id === destination.id || source.clearing) continue;

        const toSource = routeBetween(settlement, carrier.atId, source.id);
        if (!toSource) continue;
        const toDestination = routeBetween(settlement, source.id, destination.id);
        if (!toDestination) continue;

        const urgency = Math.max(0, 1 - want.fill);
        const pressure = outputPressure(source, want.item);
        const legs = toSource.length + toDestination.length;
        const here = source.id === carrier.atId ? HERE_BONUS : 0;
        const score = urgency + pressure + here - legs * LEG_PENALTY;

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

/**
 * The best shift on offer: a land work nobody is on, with room in its crate for a whole batch,
 * whose item somebody wants. Scored like a haul — how short the taker is, less the walk there and
 * on to the taker — so a villager goes to work the well a mixer is waiting on before the one at
 * the far end of town.
 */
function bestWork(settlement: Settlement, carrier: Carrier, claims: Claims, stores: boolean): Job | null {
  const busy = manned(settlement);
  let best: { job: Job; score: number } | null = null;

  // What each taker wants, worked out once. Asked afresh for every land work it was weighed
  // against, a sixty-building town recomputed it two and a half thousand times a dispatch, and
  // shifts were most of what dispatch cost.
  const wants = new Map<BuildingId, Want[]>();
  const wantsAt = (destination: Building): Want[] => {
    let list = wants.get(destination.id);
    if (!list) {
      list = wantsOf(destination, claims);
      wants.set(destination.id, list);
    }
    return list;
  };

  for (const site of settlement.buildings.values()) {
    const work = landWorkById(site.designId);
    if (!work || site.clearing || busy.has(site.id)) continue;
    if (!site.yields.includes(work.item) || groundRoom(site, work.item) < work.batch) continue;

    const toSite = routeBetween(settlement, carrier.atId, site.id);
    if (!toSite) continue;

    for (const destination of settlement.buildings.values()) {
      if (destination.id === site.id || destination.clearing || isStore(destination) !== stores) continue;
      const want = wantsAt(destination).find((entry) => entry.item === work.item);
      if (!want) continue;
      const onward = routeBetween(settlement, site.id, destination.id);
      if (!onward) continue;

      const score = Math.max(0, 1 - want.fill) - (toSite.length + onward.length) * LEG_PENALTY;
      if (!best || score > best.score) {
        best = { job: { kind: 'work', item: work.item, sourceId: site.id, destinationId: site.id }, score };
      }
    }
  }

  return best?.job ?? null;
}

/**
 * Haul for the workshops first, then work the ground for them, then haul to the stores, then
 * work the ground to fill the stores. Moving what is already made beats making more of it; and
 * the town store, which takes anything, is last at both — or it would soak up every hand the
 * workshops need.
 */
/**
 * The nearest site waiting to be cleared that nobody is clearing yet. Clearing comes before every
 * other errand — a building placed and left standing in the trees is the one thing a player waits
 * on with nothing to watch — but one villager to a site, so a new building never empties the town
 * of hands.
 */
function bestClear(settlement: Settlement, carrier: Carrier): Job | null {
  const taken = new Set<BuildingId>();
  for (const other of settlement.carriers.values()) {
    if (other.job?.kind === 'clear') taken.add(other.job.sourceId);
  }
  let best: { job: Job; legs: number } | null = null;
  for (const site of settlement.buildings.values()) {
    if (!site.clearing || taken.has(site.id)) continue;
    const route = routeBetween(settlement, carrier.atId, site.id);
    if (!route) continue;
    if (!best || route.length < best.legs) {
      best = { job: { kind: 'clear', item: ITEM_NONE, sourceId: site.id, destinationId: site.id }, legs: route.length };
    }
  }
  return best?.job ?? null;
}

export function findJob(settlement: Settlement, carrier: Carrier, claims: Claims): Job | null {
  return (
    bestClear(settlement, carrier) ??
    bestJob(settlement, carrier, claims, false) ??
    bestWork(settlement, carrier, claims, false) ??
    bestJob(settlement, carrier, claims, true) ??
    bestWork(settlement, carrier, claims, true)
  );
}

function beginLeg(settlement: Settlement, carrier: Carrier): void {
  const legs = carrier.route;
  const next = legs[0];
  if (next === undefined) {
    carrier.pathId = null;
    return;
  }
  const path = settlement.paths.get(next);
  if (!path) {
    carrier.pathId = null;
    carrier.route = [];
    return;
  }
  carrier.pathId = path.id;
  carrier.direction = path.fromId === carrier.atId ? 1 : -1;
  carrier.progress = carrier.direction === 1 ? 0 : 1;
}

function setRoute(settlement: Settlement, carrier: Carrier, route: readonly PathId[]): void {
  carrier.route = [...route];
  beginLeg(settlement, carrier);
}

export function assignJob(settlement: Settlement, carrier: Carrier, job: Job): boolean {
  const route = routeBetween(settlement, carrier.atId, job.sourceId);
  if (!route) return false;

  carrier.job = job;
  setRoute(settlement, carrier, route);
  if (job.kind === 'work' || job.kind === 'clear') {
    if (route.length === 0) arrive(settlement, carrier);
    else carrier.state = CarrierState.MovingToWork;
    return true;
  }
  carrier.state = route.length === 0 ? CarrierState.PickingUp : CarrierState.MovingToSource;
  carrier.handling = route.length === 0 ? HANDLING_TICKS : 0;
  return true;
}

/** At the site it walked to: in to work a shift, or out among the trees to clear it. */
function arrive(settlement: Settlement, carrier: Carrier): void {
  if (carrier.job?.kind === 'clear') carrier.state = CarrierState.Clearing;
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

function syncPosition(settlement: Settlement, carrier: Carrier): void {
  if (carrier.pathId === null) {
    const standing = settlement.buildings.get(carrier.atId);
    if (standing) carrier.position = { ...standing.position };
    return;
  }
  const path = settlement.paths.get(carrier.pathId);
  if (!path) return;
  const { position, heading } = pointAlongPath(path.points, carrier.progress);
  carrier.position = position;
  carrier.heading = carrier.direction === 1 ? heading : { x: -heading.x, y: -heading.y };
}

/** Advance along the current leg; returns true once the whole route is walked. */
function walk(settlement: Settlement, carrier: Carrier): boolean {
  if (carrier.pathId === null) return true;
  const path = settlement.paths.get(carrier.pathId);
  if (!path) return true;

  const step = CARRIER_SPEED / Math.max(1, path.length);
  carrier.progress += step * carrier.direction;
  carrier.walked += CARRIER_SPEED;

  const arrived = carrier.direction === 1 ? carrier.progress >= 1 : carrier.progress <= 0;
  if (!arrived) {
    syncPosition(settlement, carrier);
    return false;
  }

  carrier.progress = carrier.direction === 1 ? 1 : 0;
  carrier.atId = otherEnd(path, carrier.atId);
  carrier.route.shift();

  if (carrier.route.length === 0) {
    carrier.pathId = null;
    syncPosition(settlement, carrier);
    return true;
  }

  beginLeg(settlement, carrier);
  syncPosition(settlement, carrier);
  return false;
}

function otherTakerFor(settlement: Settlement, item: ItemType, exclude: BuildingId): BuildingId | null {
  for (const building of settlement.buildings.values()) {
    if (building.id === exclude) continue;
    if (hopperSpace(building, item) > 0) return building.id;
  }
  return null;
}

export function stepCarrier(settlement: Settlement, carrier: Carrier, tick: number): TickEvent[] {
  const events: TickEvent[] = [];
  const job = carrier.job;

  switch (carrier.state) {
    case CarrierState.Idle:
      syncPosition(settlement, carrier);
      break;

    case CarrierState.MovingToSource:
      if (walk(settlement, carrier)) {
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
      const route = routeBetween(settlement, carrier.atId, job.destinationId);
      if (!route) {
        carrier.state = CarrierState.Idle;
        break;
      }
      setRoute(settlement, carrier, route);
      carrier.state = route.length === 0 ? CarrierState.DroppingOff : CarrierState.MovingToDest;
      carrier.handling = route.length === 0 ? HANDLING_TICKS : 0;
      break;
    }

    case CarrierState.MovingToDest:
      if (walk(settlement, carrier)) {
        carrier.state = CarrierState.DroppingOff;
        carrier.handling = HANDLING_TICKS;
      }
      break;

    case CarrierState.MovingToWork:
      if (walk(settlement, carrier)) arrive(settlement, carrier);
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
          const route = routeBetween(settlement, carrier.atId, taker);
          if (route) {
            carrier.job = { ...job, destinationId: taker };
            setRoute(settlement, carrier, route);
            carrier.state = route.length === 0 ? CarrierState.DroppingOff : CarrierState.MovingToDest;
            carrier.handling = route.length === 0 ? HANDLING_TICKS : 0;
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
