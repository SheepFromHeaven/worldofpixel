import { capacityOf, groundWork, isStoreArea, rigAt, setLines, shelteredArea, stationSlot } from '../sim/area.ts';
import { linesFor } from '../sim/process.ts';
import { labelOf } from '../sim/buildings.ts';
import { depositHopper, processBuilding, roomFor, storedStock, withdraw } from '../sim/buildings.ts';
import { totalHeld } from '../sim/stock.ts';
import {
  DAY_HOURS,
  DAY_TICKS,
  FORAGE_TICKS,
  LOW,
  VESSEL_LITRES,
  bedsIn,
  canHaul,
  dayOf,
  neediest,
  vesselsHeld,
} from '../sim/needs.ts';
import { addBuilding, canBuild, placeBuilding, raze } from '../sim/construction.ts';
import { chapterProgress, designOpen, nextSteps, openingItems, workOpen } from '../sim/chapter.ts';
import {
  CORD_WALK,
  DAUB_PIT,
  HEARTH_DESIGN,
  HEARTH_DESIGN_ID,
  LEAN_TO_ID,
  PIT_FIRING_ID,
  WEAVING_FRAME,
} from '../sim/designs.ts';
import { LogisticsEngine } from '../sim/engine.ts';
import { distance, pointInPolygon } from '../sim/geometry.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { BUILDING_REACH, HEARTH_REACH, STONE_SPACING, claimOf, claims, inClaim, proposedClaim } from '../sim/claims.ts';
import { clearingFor } from '../sim/clearing.ts';
import { isLandWork, landWorkById } from '../sim/landWorks.ts';
import { restoreWorld, saveWorld } from '../sim/save.ts';
import { landYield } from '../sim/markers.ts';
import { PARCEL, cellsIn, parcelAt, parcelOf } from '../sim/parcels.ts';
import { fadeWear, neighbours, paceAt, positionOf, route, routeCost, wornness } from '../sim/footpaths.ts';
import { biomeAt, nearestWater, riverRunsIn, terrainAt, waterBetween } from '../sim/terrain.ts';
import { FIELD } from '../sim/heightmap.ts';
import { RIVER_FLUX, Water } from '../sim/hydrology.ts';
import { buildField, fieldFor, isFresh, isWater } from '../sim/worldfield.ts';
import { Biome, BuildingState, CarrierState, ItemType } from '../sim/types.ts';
import type { Building, CellId, Design, Settlement, TickEvent } from '../sim/types.ts';
import type { GameWorld } from '../sim/world.ts';
import { buildingOn, canFound, foundSettlement, generateWorld } from '../sim/worldgen.ts';
import {
  CHARGE_HIGH,
  CHARGE_LOW,
  CHARGE_STEADY,
  EMBERS_METHOD,
  SEAL_METHOD,
  addMethod,
  methodById,
} from '../sim/book.ts';
import type { Method } from '../sim/book.ts';
import { batchTicks, ceilingOf, costOf, runRig, scanQueue } from '../sim/process.ts';
import { RIGS, RIG_IDS, char, envelopeOf, fire, glowOf } from '../sim/models/heat.ts';
import type { RigId } from '../sim/models/heat.ts';
import { clay } from '../sim/models/clay.ts';
import { knap } from '../sim/models/fracture.ts';
import { header, renderTick, verdict } from './render.ts';
import { runLevel17 } from './level17.ts';
import { runLevel18 } from './level18.ts';
import { runLevel19 } from './level19.ts';
import { runLevel20 } from './level20.ts';

export interface LevelResult {
  id: string;
  title: string;
  passed: boolean;
  detail: string;
}

export type Logger = (line: string) => void;

const SEED = 20261017;
/** Trace every Nth tick: a 900-tick haul printed in full is unreadable. */
const TRACE_EVERY = 60;
/**
 * Where the levels settle. Marsh country on a river: a town that is to carry water needs reeds
 * as much as it needs a bank, and the two are not found together everywhere.
 */
const MIDDLE: Vec2 = { x: 558, y: 421 };
/** How far from the water a bank with reeds beside it may be looked for. */
const REACH = 40;

export interface Harness {
  world: GameWorld;
  engine: LogisticsEngine;
  settlement: Settlement;
  events: TickEvent[];
  well: Building;
  bank: Building;
  leanTo: Building;
  reedBed: Building;
  woodcutter: Building;
  cordWalk: Building;
  weavingFrame: Building;
  daubPit: Building;
}

export function workOf(id: string): Design {
  const work = landWorkById(id);
  if (!work) throw new Error(`there is no land work ${id}`);
  return work.design;
}

export function designFrom(world: GameWorld, id: string): Design {
  const design = world.library.get(id);
  if (!design) throw new Error(`the library has no ${id}`);
  return design;
}

/** Free land near a point, nearest first, skipping anything already spoken for. */
export function freeParcelsNear(world: GameWorld, centre: Vec2, reach: number): CellId[] {
  return cellsIn(world.seed, PARCEL, {
    minX: centre.x - reach,
    minY: centre.y - reach,
    maxX: centre.x + reach,
    maxY: centre.y + reach,
  })
    // Dry and unbuilt — not `canFound`, which also refuses ground inside a town's claim, and that
    // is exactly the ground a town's own buildings have to go on.
    .filter((parcel) => !isWater(parcel.biome) && !buildingOn(world, parcel.id))
    .sort((a, b) => distance(a.site, centre) - distance(b.site, centre) || (a.id < b.id ? -1 : 1))
    .map((parcel) => parcel.id);
}

/**
 * A tile with water running through it, a marsh within walking distance of it, and somewhere
 * free beside both to put the fire. Any ground can be settled — a hearth needs nothing, and
 * earth is under every parcel — but a town that is to carry water has to be able to reach both
 * a bank and a reed bed: the basket is woven and daubed before anything is fetched in it.
 */
function foundBesideWater(world: GameWorld): {
  settlement: Settlement;
  water: CellId;
  reeds: CellId;
} {
  // Walk to the water first and look for a bank there, rather than sweeping the parcels of half
  // a continent: the lattice is built cell by cell, and a 400-unit square of it is forty
  // thousand Voronoi cells to answer a question the field can answer directly.
  const water = nearestWater(world.seed, MIDDLE) ?? MIDDLE;
  const near = freeParcelsNear(world, water, REACH);
  const banks = near.filter((id) => landYield(world, id).includes(ItemType.Water));
  const beds = near.filter((id) => parcelOf(world.seed, id).biome === Biome.Marsh);
  // Both have to fall inside the claim the fire draws round itself, or the town is founded
  // somewhere it may not dig: `canBuild` asks the claim before it asks the ground.
  const reach = HEARTH_REACH * PARCEL;

  for (const site of near) {
    const middle = parcelOf(world.seed, site).site;
    // Water the band can actually walk to, which is what the day's first hour and a half is
    // (`needs.ts`): a hearth further off than its own ground pays the walk twice a trip.
    const drink = nearestWater(world.seed, middle);
    if (!drink || distance(drink, middle) > reach) continue;
    const held = (id: CellId) =>
      id !== site && distance(parcelOf(world.seed, id).site, middle) <= reach;
    const bank = banks.find(held);
    const reeds = beds.find((id) => id !== bank && held(id));
    if (!bank || !reeds) continue;
    return { settlement: foundSettlement(world, site), water: bank, reeds };
  }

  throw new Error('no bank with reeds within a fire\'s reach anywhere near the middle');
}

/**
 * Raise the town the way a player must: in the chapter's own order.
 *
 * Founding hands over a fire and nothing else, and `canBuild` refuses anything the town has not
 * reached (`chapter.ts`) — so this is not a convenient order, it is the only one. Each line here
 * is a step that opened because the line above it was taken, which is also why the harness is
 * the cheapest test there is that the spine is actually walkable: get it wrong and nothing is
 * raised at all.
 */
function raiseTheTown(world: GameWorld, settlement: Settlement, water: CellId, reeds: CellId) {
  const hearth = settlement.buildings.get(settlement.hearthId);
  if (!hearth) throw new Error('a settlement with no hearth');

  // Worked out once. Laying the parcels round the town out again for every building is most of
  // what a harness costs, and the only thing that changes between one and the next is which of
  // them are now spoken for.
  const plots = freeParcelsNear(world, hearth.position, 70);
  // Each on fresh ground, the hearth's parcel included: the harness raises one station to an area,
  // the way the town was built before areas took more than one, so what it measures stays put.
  const taken = new Set<CellId>([water, reeds, hearth.cellId]);
  const raise = (design: Design): Building => {
    const site = plots.find((id) => !taken.has(id) && canBuild(world, settlement, id, design).ok);
    if (!site) throw new Error(`nowhere in the claim for a ${design.label}`);
    taken.add(site);
    return placeBuilding(world, settlement, site, design);
  };
  const at = (cellId: CellId, design: Design): Building =>
    placeBuilding(world, settlement, cellId, design);

  // Age I: a forage camp gathering deadwood for the fire — nobody has an axe, so nobody fells
  // anything — and mud out of a bank, which is the only mud there is until somebody can carry
  // water. That circle is what the whole opening turns on (`needs.ts`).
  // The camp is founded with the fire, in the same area, so it is the town's own: what it gathers
  // lands on the shelf the fire burns off.
  const woodcutter = hearth;
  const bank = raise(workOf('bank-dig'));

  // Age II is the road to the first vessel. Reeds are combed at the bed, walked into cord, woven
  // over withies, and the basket is daubed and dried at the fire. Raising the frame and the pit
  // is what teaches the town to seal (step 10), and sealing is what opens the well below.
  const reedBed = at(reeds, workOf('reed-bed'));
  const cordWalk = raise(CORD_WALK);
  const weavingFrame = raise(WEAVING_FRAME);
  const daubPit = raise(DAUB_PIT);

  // Step 11 onward, which only exist because the chain above ran. There is no dig site: earth
  // is for the brick ground, which is step 12 and is not built, so nothing wants Dirt yet.
  const well = at(water, workOf('well'));
  const leanTo = raise(designFrom(world, LEAN_TO_ID));

  return { well, bank, reedBed, woodcutter, cordWalk, weavingFrame, daubPit, leanTo };
}

export function harness(): Harness {
  const world = generateWorld(SEED);
  const { settlement, water, reeds } = foundBesideWater(world);
  const raised = raiseTheTown(world, settlement, water, reeds);
  return { world, engine: new LogisticsEngine(world), settlement, events: [], ...raised };
}

export function play(harness: Harness, ticks: number, log: Logger, trace = TRACE_EVERY): void {
  for (let i = 0; i < ticks; i += 1) {
    const report = harness.engine.tick();
    harness.events.push(...report.events);
    if (trace > 0 && report.tick % trace === 0) log(renderTick(harness.settlement, report));
  }
}

function firstEvent(events: TickEvent[], match: Partial<TickEvent>): TickEvent | undefined {
  return events.find((event) =>
    (Object.keys(match) as (keyof TickEvent)[]).every((key) => event[key] === match[key]),
  );
}

/** One need seen to: which, how long from setting off to done, and where. */
interface Errand {
  carrierId: string;
  kind: string;
  ticks: number;
  /** Out of a store's stock (a drink or a meal) or under a roof (a sleep). */
  easy: boolean;
}

interface Watched {
  errands: Errand[];
  /** The longest any one need of any villager stayed at or under `LOW`, in ticks. */
  longestLow: number;
  /** Times a villager with a need down to its mark set off on work instead. */
  workedWhileLow: number;
}

/**
 * Ticks an engine and watches every villager's needs: each errand from the tick it was taken to
 * the tick it was done, how long anybody went with a need unmet, and whether anybody took work
 * while one was down to its mark.
 */
function watchNeeds(run: { engine: LogisticsEngine; settlement: Settlement; events: TickEvent[] }, ticks: number): Watched {
  const open = new Map<string, { kind: string; from: number; easy: boolean }>();
  const low = new Map<string, number>();
  const watched: Watched = { errands: [], longestLow: 0, workedWhileLow: 0 };
  const needKinds = new Set(['drink', 'eat', 'sleep']);

  for (let i = 0; i < ticks; i += 1) {
    const before = new Map([...run.settlement.carriers.values()].map((c) => [c.id, { job: c.job, need: neediest(c) }]));
    const report = run.engine.tick();
    run.events.push(...report.events);
    for (const carrier of run.settlement.carriers.values()) {
      const was = before.get(carrier.id);
      const job = carrier.job;
      if (was && was.job === null && job && !needKinds.has(job.kind) && was.need !== null) watched.workedWhileLow += 1;

      const tracked = open.get(carrier.id);
      if (tracked && job?.kind !== tracked.kind) {
        watched.errands.push({ carrierId: carrier.id, kind: tracked.kind, ticks: report.tick - tracked.from, easy: tracked.easy });
        open.delete(carrier.id);
      }
      if (job && needKinds.has(job.kind) && !open.has(carrier.id)) {
        const site = run.settlement.buildings.get(job.sourceId);
        const easy =
          job.kind === 'sleep'
            ? site !== undefined && shelteredArea(site)
            : !job.spot && site !== undefined && storedStock(site, job.item) > 0;
        open.set(carrier.id, { kind: job.kind, from: report.tick, easy });
      }

      for (const meter of ['thirst', 'hunger', 'rest'] as const) {
        const key = `${carrier.id}:${meter}`;
        if (carrier.needs[meter] <= LOW) {
          const since = low.get(key) ?? report.tick;
          low.set(key, since);
          watched.longestLow = Math.max(watched.longestLow, report.tick - since);
        } else {
          low.delete(key);
        }
      }
    }
  }
  return watched;
}

const meanTicks = (errands: Errand[]): number =>
  errands.length === 0 ? 0 : Math.round(errands.reduce((sum, e) => sum + e.ticks, 0) / errands.length);

/**
 * LEVEL 1 — the water hole, which is what a well is *for*.
 *
 * A villager gets thirsty about four times a day and goes to drink. With nothing but the fire
 * that is a walk to the bank and a drink there; once the town has a vessel and a well, water
 * stands in a store and a drink is had at the door. What is asserted is how long a drink takes,
 * before and after, and the vessel that had to come first.
 */
export function runLevel1(log: Logger): LevelResult {
  log(header('LEVEL 1 — The water hole: what a well buys, which is time and not water'));

  // A town that has only its fire, drinking at the bank.
  const fresh = generateWorld(SEED);
  const camp = { engine: new LogisticsEngine(fresh), settlement: foundBesideWater(fresh).settlement, events: [] as TickEvent[] };
  const camped = watchNeeds(camp, DAY_TICKS * 2).errands.filter((e) => e.kind === 'drink');
  log(`  camped at the river: ${camped.length} drinks, ${meanTicks(camped)} ticks each, every one at the bank`);

  const run = harness();
  const { settlement } = run;
  play(run, 10000, log, 2000);
  const sunk = watchNeeds(run, DAY_TICKS * 2).errands.filter((e) => e.kind === 'drink');
  const stored = sunk.filter((e) => e.easy);
  log(`  with the hole sunk: ${sunk.length} drinks, ${stored.length} out of a store, ${meanTicks(stored)} ticks each`);

  const sited = settlement.buildings.get(run.well.id) !== undefined;
  const wasStepEleven = workOpen(settlement, 'well');
  const neededAVessel = vesselsHeld(settlement) > 0;
  const atTheBank = camped.length > 0 && camped.every((e) => !e.easy);
  const quicker = stored.length > 0 && meanTicks(stored) < meanTicks(camped);
  const walked = [...settlement.carriers.values()].every((carrier) => carrier.walked > 0);

  const checks: [string, boolean][] = [
    ['a water hole is sunk, and only once the chapter reached it', sited && wasStepEleven],
    ['which took a vessel first, because nobody fetches without one', neededAVessel],
    ['before it, every drink is a walk to the bank', atTheBank],
    ['after it, water stands in a store and a drink there is quicker', quicker],
    ['everybody walked', walked],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-1',
    title: 'The water hole',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `a drink took ${meanTicks(camped)} ticks at the bank and ${meanTicks(stored)} out of a store`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

export function runLevel3(log: Logger): LevelResult {
  log(header('LEVEL 3 — Mud and the town store: what is made ends up at the fire'));
  const run = harness();
  // The daub pit is fed before the store is, so the mud the fire ends up holding is what was
  // spare after Age II had what it wanted (`carriers.ts`) — which is a good many days off.
  play(run, 20000, log, 2000);

  const hearth = run.settlement.buildings.get(run.settlement.hearthId);
  if (!hearth) throw new Error('a settlement with no hearth');

  const made = firstEvent(run.events, { kind: 'produced', item: ItemType.Mud });
  // Whatever the town made and nobody else wanted. Not Mud in particular: the daub pit takes
  // every scrap of that, which is the store doing its job rather than failing at it — a store is
  // the destination of *last* resort, so what lands in one is what the workshops passed over.
  const stored = totalHeld(hearth);
  const stalled = run.events.filter((event) => event.kind === 'stalled');

  // Two warehouses and the hearth, with stock sitting in one of them and no reason for any of it
  // to move: a store may feed a workshop, never another store. Without that rule a load shuttles
  // between two of them for ever, each taking it in because nobody else wanted it.
  const still = generateWorld(SEED + 11);
  const quiet = foundBesideWater(still).settlement;
  const quietHearth = quiet.buildings.get(quiet.hearthId);

  // A store holds what arrives and hands it back. The fire used to be a square in the middle of
  // the floor that swallowed whatever reached it, and the two were always different things:
  // fetching from the town store is the point of having one, and a store that destroyed goods
  // could never hand them back. What eats is the hearth's *rig*, through its methods.
  const handedIn = quietHearth ? depositHopper(quietHearth, ItemType.Pot, 1) : 0;
  const handedBack = quietHearth ? withdraw(quietHearth, ItemType.Pot, 1) : 0;
  const keepsWhatArrives = handedIn === 1 && handedBack === 1;

  const warehouse: Design = { id: 'warehouse', label: 'Warehouse', capacity: 8, store: true };

  // Set down with `addBuilding` rather than raised: a warehouse is not one of the chapter's
  // buildings and `canBuild` refuses anything the town has not reached, which is the right
  // answer to a player and the wrong one to a level about what dispatch does with two stores.
  const sites = freeParcelsNear(still, quietHearth?.position ?? MIDDLE, 60);
  const put = (id: CellId): Building =>
    addBuilding(still, quiet, parcelOf(still.seed, id), warehouse);
  const first = put(sites[0] ?? '');
  const second = put(sites[1] ?? '');
  first.clearing = null;
  second.clearing = null;
  depositHopper(first, ItemType.Mud, 5);
  new LogisticsEngine(still).run(300);

  const hoarded = storedStock(first, ItemType.Mud);
  const leaked =
    storedStock(second, ItemType.Mud) + storedStock(quietHearth ?? first, ItemType.Mud);

  const checks: [string, boolean][] = [
    ['a bank gives up its mud', Boolean(made)],
    ['what nobody else wanted reaches the town store', stored > 0],
    ['no carrier stalled', stalled.length === 0],
    ['the fire holds what is brought it, and hands it back', keepsWhatArrives],
    ['the fire is the town store, eight of each thing to begin with', isStoreArea(hearth) && capacityOf(hearth) === 8],
    ['a store never feeds another store', hoarded === 5 && leaked === 0],
  ];

  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-3',
    title: 'Mud and the store',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `first mud on tick ${made?.tick}, ${stored} standing at the fire`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

export function runLevel4(log: Logger): LevelResult {
  log(header('LEVEL 4 — Determinism: one seed, one trace'));
  const first = harness();
  const second = harness();
  play(first, 400, () => {});
  play(second, 400, () => {});

  const a = first.engine.traceHash();
  const b = second.engine.traceHash();
  log(`  run A hash ${a.toString(16)}`);
  log(`  run B hash ${b.toString(16)}`);

  const passed = a === b && first.events.length === second.events.length;
  return {
    id: 'level-4',
    title: 'Determinism',
    passed,
    detail: passed ? `both runs ended on ${a.toString(16)}` : `${a.toString(16)} ≠ ${b.toString(16)}`,
  };
}

export function runLevel5(log: Logger): LevelResult {
  log(header('LEVEL 5 — The ground: one lattice, however you ask for it'));
  const fresh = generateWorld(SEED);
  const run = harness();

  // The guarantee the whole world rests on: a cell is the same cell whether it is computed on
  // its own, or as part of a sweep, or as part of a sweep framed somewhere else entirely.
  const sweep = cellsIn(fresh.seed, PARCEL, { minX: 400, minY: 300, maxX: 520, maxY: 400 });
  const offsetSweep = new Map(
    cellsIn(fresh.seed, PARCEL, { minX: 455, minY: 355, maxX: 700, maxY: 560 }).map((parcel) => [
      parcel.id,
      parcel,
    ]),
  );

  // Compared as a set of corners, not a list: a polygon is built by clipping a frame, so where
  // the loop starts depends on the frame the query used. The shape is what has to match.
  const corners = (vertices: Vec2[]): string =>
    vertices
      .map((vertex) => `${vertex.x.toFixed(4)},${vertex.y.toFixed(4)}`)
      .sort()
      .join(' ');

  const sameAlone = sweep.every(
    (parcel) => corners(parcelOf(fresh.seed, parcel.id).vertices) === corners(parcel.vertices),
  );

  let compared = 0;
  const sameAcrossSweeps = sweep.every((parcel) => {
    const other = offsetSweep.get(parcel.id);
    if (!other) return true;
    compared += 1;
    return corners(other.vertices) === corners(parcel.vertices);
  });

  const holdsItsSite = sweep.every(
    (parcel) => parcel.vertices.length < 3 || pointInPolygon(parcel.site, parcel.vertices),
  );
  const pickedCorrectly = sweep.every((parcel) => parcelAt(fresh.seed, parcel.site).id === parcel.id);
  const symmetric = sweep.every((parcel) =>
    parcel.neighbors.every((other) => parcelOf(fresh.seed, other).neighbors.includes(parcel.id)),
  );
  const terrainAgrees = sweep.every((parcel) => {
    const field = terrainAt(fresh.seed, parcel.site);
    return Math.abs(field.elevation - parcel.environment.elevation) < 1e-9;
  });

  // What the ground gives is a function of the ground, like everything else about it.
  const yieldsAgree = sweep.every(
    (parcel) =>
      landYield(fresh, parcel.id).join(',') === landYield(generateWorld(SEED), parcel.id).join(','),
  );
  const wellOnWater = run.well.yields.includes(ItemType.Water);
  const earthEverywhere = sweep
    .filter((parcel) => !isWater(parcel.biome))
    .every((parcel) => landYield(fresh, parcel.id).includes(ItemType.Dirt));
  const waterIsSited = sweep.some((parcel) => !landYield(fresh, parcel.id).includes(ItemType.Water));
  // Deadwood lies wherever anything grows, so a forage camp works a meadow as well as a wood —
  // and nowhere else. Gathering it is not felling, which is what the axe is for.
  const woodIsForest =
    sweep.some((parcel) => parcel.biome === Biome.Forest) &&
    sweep.some((parcel) => parcel.biome === Biome.Meadow) &&
    sweep.every(
      (parcel) =>
        landYield(fresh, parcel.id).includes(ItemType.Deadwood) ===
        (parcel.biome === Biome.Forest || parcel.biome === Biome.Meadow),
    );
  const nothingInTheSea = sweep
    .filter((parcel) => isWater(parcel.biome))
    .every((parcel) => landYield(fresh, parcel.id).length === 0);

  log(`  ${sweep.length} parcels swept, ${compared} of them re-checked from a second sweep`);

  const checks: [string, boolean][] = [
    ['a new world holds nothing but its seed and its library', fresh.settlements.size === 0],
    ['a parcel computed alone matches the sweep', sameAlone],
    ['a parcel is the same from any sweep', sameAcrossSweeps && compared > 0],
    ['every parcel contains its own site', holdsItsSite],
    ['a point lands in the parcel that owns it', pickedCorrectly],
    ['neighbours agree with each other', symmetric],
    ['parcels read the shared terrain field', terrainAgrees],
    ['what the ground yields is a function of the ground', yieldsAgree],
    ['a well on the water draws water', wellOnWater],
    ['earth is under every parcel of land', earthEverywhere],
    ['water is only where the water is', waterIsSited],
    ['deadwood lies in wood and meadow, and nowhere else', woodIsForest],
    ['the sea yields nothing', nothingInTheSea],
    [
      'every standing building keeps its own copy of its blueprint',
      [...run.settlement.buildings.values()].every(
        (building) =>
          building.slots.every(
            (slot) =>
              !slot.design ||
              slot.design !== (run.world.library.get(slot.design.id) ?? landWorkById(slot.design.id)?.design),
          ),
      ),
    ],
  ];

  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-5',
    title: 'The ground',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `${checks.length} checks over ${sweep.length} parcels`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

export function runLevel6(log: Logger): LevelResult {
  log(header('LEVEL 6 — The chapter: a town opens with its fire, and earns the rest in order'));

  const world = generateWorld(SEED);
  const { settlement, water, reeds } = foundBesideWater(world);
  const hearth = settlement.buildings.get(settlement.hearthId);
  if (!hearth) throw new Error('a settlement with no hearth');

  const opening = [...settlement.buildings.values()];
  const foundedWith =
    hearth.slots.length === 2 &&
    hearth.slots[0]?.design?.id === HEARTH_DESIGN_ID &&
    hearth.slots[1]?.design?.id === 'forage-camp' &&
    hearth.stage === 1;
  const openNow = (): string[] => nextSteps(settlement).map((step) => step.label);

  // What the founding overlay promises is what founding delivers: the ground a hearth *would*
  // hold, asked of an untouched copy of the world, is the ground the founded town does hold.
  // And what it marks as wanted is the opening itself — the items of the land works that follow
  // from the fire alone — not a list kept beside the chapter.
  const unfounded = generateWorld(SEED);
  const promised = proposedClaim(unfounded, hearth.cellId);
  const promiseKept = promised.length > 0 && promised.join() === claimOf(world, settlement).join();
  const wantsTheOpening = openingItems().join() === 'Deadwood,Mud';
  log(`  a hearth here would hold ${promised.length} parcels; wanting first: ${openingItems().join(' and ')}`);
  log(`  founded on a fire alone; it may site ${openNow().join(' or ')}`);

  // Age I and nothing else. A kiln on the bar at minute zero is not a slow game, it is a
  // different one: there is nothing to find out and no reason to want anything.
  const opensOnAgeI = openNow().join(',') === 'Bank dig';
  const kilnRefused = !designOpen(settlement, PIT_FIRING_ID);
  const wellRefused = !workOpen(settlement, 'well');
  const refusal = canBuild(world, settlement, reeds, workOf('reed-bed'));

  // The hearth is founded knowing how to bank a fire and nothing else. Sealing a basket is a
  // step the town has to reach — a method it was born with would not be one.
  const bornKnowing = linesFor(hearth, stationSlot(hearth)).join(',') === EMBERS_METHOD;

  // Walk it. Each of these is only placeable because the one above it was taken.
  const raised = raiseTheTown(world, settlement, water, reeds);
  const walked = settlement.buildings.size === opening.length + 7;

  // Step 10 is a recipe rather than a building, so nothing is raised for it: the moment the
  // frame and the pit are standing the town knows how to seal, and it goes on the fire.
  const learntToSeal = linesFor(hearth, stationSlot(hearth)).includes(SEAL_METHOD);
  const wellOpenNow = workOpen(settlement, 'well');
  log(`  with the frame and the pit up it knows ${linesFor(hearth, stationSlot(hearth)).join(' > ')}`);

  const progress = chapterProgress(settlement);
  log(`  ${progress.done.size} steps done, in the age of ${progress.age}; next: ${openNow().join(', ') || 'nothing'}`);

  // Razing a rig takes the *step* back — the chapter is derived from what stands, so there is
  // no flag to go stale — but it does not take the knowledge. A town that pulled down its daub
  // pit still knows how to seal a basket, because a method lives in the book and the book is
  // what the town found out. That is the whole reason the two are kept apart.
  raze(world, settlement, raised.daubPit.id);
  const stepUndone = !chapterProgress(settlement).done.has(9);
  const stillKnowsIt = linesFor(hearth, stationSlot(hearth)).includes(SEAL_METHOD);

  // A town with no reeds is not shut out of cord: on a second, untouched copy of the world the
  // bank is dug, and then a fibre patch on growing ground that is not marsh — where a reed bed is
  // refused — opens the cord walk and the daub pit on its own.
  const dryWorld = generateWorld(SEED);
  const dry = foundBesideWater(dryWorld);
  const dryPlots = freeParcelsNear(dryWorld, dry.settlement.buildings.get(dry.settlement.hearthId)!.position, 70);
  const firstOk = (design: Design) => dryPlots.find((id) => canBuild(dryWorld, dry.settlement, id, design).ok);
  const dryBank = firstOk(workOf('bank-dig'));
  if (dryBank) placeBuilding(dryWorld, dry.settlement, dryBank, workOf('bank-dig'));
  const patchSite = dryPlots.find(
    (id) =>
      canBuild(dryWorld, dry.settlement, id, workOf('fibre-patch')).ok &&
      !canBuild(dryWorld, dry.settlement, id, workOf('reed-bed')).ok,
  );
  const reedsOffMarsh = patchSite !== undefined;
  if (patchSite) placeBuilding(dryWorld, dry.settlement, patchSite, workOf('fibre-patch'));
  const patchOpensCord =
    designOpen(dry.settlement, CORD_WALK.id) && designOpen(dry.settlement, DAUB_PIT.id) && !chapterProgress(dry.settlement).done.has(6.5);
  log(`  without a reed bed: a fibre patch on ${patchSite ? parcelOf(dryWorld.seed, patchSite).biome : 'nothing'} opens the cord walk: ${patchOpensCord}`);

  const hearthRefused = canBuild(world, settlement, water, HEARTH_DESIGN);
  const hearthStays = !raze(world, settlement, hearth.id);

  const checks: [string, boolean][] = [
    ['a new settlement is one work area with a fireplace and a forage camp in it', opening.length === 1 && foundedWith],
    ['a reed bed wants marsh, and a fibre patch takes growing ground elsewhere', reedsOffMarsh],
    ['and a fibre patch alone opens the cord walk and the daub pit', patchOpensCord],
    ['and it opens on Age I alone', opensOnAgeI],
    ['founding holds the ground the overlay showed', promiseKept],
    ['and the overlay puts forward what the opening wants', wantsTheOpening],
    ['a kiln is not on the bar before there is a reason to want one', kilnRefused],
    ['nor a well, which is step eleven', wellRefused],
    ['something out of reach is refused in the town’s own name', !refusal.ok && refusal.reason.includes('worked out')],
    ['the fire is founded knowing one method, not the book', bornKnowing],
    ['the chapter can be walked end to end', walked],
    ['a method step is written up the moment it is earned', learntToSeal],
    ['and earning it opens what follows', wellOpenNow],
    ['razing a rig takes its step back', stepUndone],
    ['but never the method: the book is what the town found out', stillKnowsIt],
    ['the hearth is not the player’s to place or to raze', !hearthRefused.ok && hearthStays],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-6',
    title: 'The chapter',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `opened on a fire, walked ${progress.done.size} steps into the age of ${progress.age}`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

export function runLevel7(log: Logger): LevelResult {
  log(header('LEVEL 7 — Water: it runs downhill, and a well stands where it runs'));
  const world = generateWorld(SEED);
  const field = fieldFor(SEED);
  const { grid } = field;
  const around = cellsIn(world.seed, PARCEL, {
    minX: MIDDLE.x - 150,
    minY: MIDDLE.y - 150,
    maxX: MIDDLE.x + 150,
    maxY: MIDDLE.y + 150,
  });

  // Follow every river from its head — the cells with a river in them that nothing upstream
  // feeds. Water that climbs, or that stops in the middle of the land, means the hollows were
  // not resolved, and the symptom in the game is a river drawn across a hillside ending nowhere.
  const heads = riverHeads(field);
  let climbed = 0;
  let stranded = 0;
  let intoLakes = 0;
  for (const head of heads) {
    let cell = head;
    let steps = 0;

    for (;;) {
      const next = field.into[cell]!;
      if (next < 0 || steps > grid.columns * 4) {
        stranded += 1;
        break;
      }
      if (field.surface[next]! > field.surface[cell]!) climbed += 1;
      if (field.water[next] !== Water.None) {
        if (field.water[next] === Water.Lake) intoLakes += 1;
        break;
      }
      cell = next;
      steps += 1;
    }
  }

  // What is drawn as water is what cannot be built on.
  //
  // A parcel is water when the river is drawn over its *site*, which is the only test that can
  // agree with the painter — so the sample is parcels the rules already call river, not points
  // picked off the river itself. A creek that runs between two sites is water nowhere, and is
  // drawn all the same: that is the rule, not a gap in it.
  // A town that has walked the chapter as far as its water hole, because `canBuild` refuses a
  // step the town has not reached *before* it looks at the ground (`chapter.ts`) — and what is
  // being asked here is only ever about the ground.
  const { settlement, water, reeds } = foundBesideWater(world);
  raiseTheTown(world, settlement, water, reeds);
  // The rule a well is sited by: water in the tile, and nowhere else. Every parcel the river is
  // drawn across gives water, and every parcel it is not drawn across does not — which is the
  // whole of what the player has to read off the map.
  const banks = around.filter(
    (parcel) => !isWater(parcel.biome) && landYield(world, parcel.id).includes(ItemType.Water),
  );
  const dryGround = around.filter(
    (parcel) => !isWater(parcel.biome) && !landYield(world, parcel.id).includes(ItemType.Water),
  );
  // Followed through to what it means in the game, which is a different path through the code
  // than the one that decided it: every bank takes a well and no dry tile does. Siting is the
  // whole of the opening, so this is the rule that has to hold over thousands of parcels and
  // not just over the one the level happens to build on.
  //
  // Only inside the town's claim, where siting is the question being asked: outside it every
  // parcel is refused for the claim before the ground is looked at (`canBuild`). The sweep over
  // the whole sample is still made, through `landYield`, which is what defines `banks` above.
  const well = workOf('well');
  const taken = new Set([...settlement.buildings.values()].map((building) => building.cellId));
  const claimed = (parcel: { id: CellId }): boolean => inClaim(world, settlement, parcel.id);
  const claimedBanks = banks.filter((parcel) => claimed(parcel) && !taken.has(parcel.id));
  const wellsGoOnBanks =
    claimedBanks.length > 0 && claimedBanks.every((parcel) => canBuild(world, settlement, parcel.id, well).ok);
  const wellsRefusedOnDry = dryGround
    .filter(claimed)
    .every((parcel) => !canBuild(world, settlement, parcel.id, well).ok);
  const banksOutsideRefusedForTheClaim = banks
    .filter((parcel) => !claimed(parcel))
    .every((parcel) => canBuild(world, settlement, parcel.id, well).reason.includes('claim'));
  const wellsAreSited = banks.length > 0 && dryGround.length > banks.length;

  // The other half of the rule, and the half a player reads off the map first: a tile that
  // shares an edge with fresh water has water, whether or not the lake happens to reach over
  // the line the lattice drew. The sea gives nothing, which is the whole of `isFresh`.
  const besideWater = around.filter(
    (parcel) =>
      !isWater(parcel.biome) &&
      parcel.neighbors.some((id) => isFresh(parcelOf(world.seed, id).biome)),
  );
  const shoresGiveWater = besideWater.every((parcel) =>
    landYield(world, parcel.id).includes(ItemType.Water),
  );
  // A coast with nothing fresh on it: the sea is the one shore that gives nothing, and the whole
  // point of `isFresh`. Which tiles those are is settled by asking the *painter* where the rivers
  // are — a different index than either half of the rule reads — so this is a check and not an
  // echo. (`nearestWater` is no use here: it answers from one mark per sixty units, which calls
  // a river mouth twenty units away when it is next door.)
  const saltOnly = around.filter(
    (parcel) =>
      !isWater(parcel.biome) &&
      parcel.neighbors.some((id) => parcelOf(world.seed, id).biome === Biome.Ocean) &&
      !parcel.neighbors.some((id) => isFresh(parcelOf(world.seed, id).biome)) &&
      riverRunsIn(world.seed, {
        minX: parcel.site.x - PARCEL * 2,
        minY: parcel.site.y - PARCEL * 2,
        maxX: parcel.site.x + PARCEL * 2,
        maxY: parcel.site.y + PARCEL * 2,
      }).length === 0,
  );
  const seaGivesNothing = saltOnly.every(
    (parcel) => !landYield(world, parcel.id).includes(ItemType.Water),
  );

  const onTheWater = around.filter((parcel) => isWater(parcel.biome));
  const onRivers = around.filter((parcel) => parcel.biome === Biome.River);
  const riversBlock = onRivers.length > 0;
  const nothingFoundedInWater = onTheWater.every((parcel) => !canFound(world, parcel.id).ok);
  // Nobody sets out across the water: a walk that starts in it is no walk.
  const hearthCell = settlement.buildings.get(settlement.hearthId)!.cellId;
  const noWalkInWater = onTheWater.every((parcel) => route(world, parcel.id, hearthCell) === null);
  const nothingBuiltInWater = onTheWater.every(
    (parcel) => !canBuild(world, settlement, parcel.id, workOf('digging')).ok,
  );

  // Every cell a river is drawn in carries at least what it takes to be one.
  const riversCarryWater = heads.every((cell) => field.flux[cell]! >= RIVER_FLUX);

  // The world is built, not sampled — so the thing to prove is that building it twice builds
  // the same world. Everything downstream of this file relies on it.
  const again = buildField(SEED);
  let sameGround = again.biome.length === field.biome.length;
  for (let cell = 0; sameGround && cell < field.biome.length; cell += 1) {
    if (again.biome[cell] !== field.biome[cell] || again.water[cell] !== field.water[cell]) {
      sameGround = false;
    }
  }
  const sameRivers = again.rivers.segments.length === field.rivers.segments.length;

  let lakes = 0;
  let ocean = 0;
  for (let cell = 0; cell < field.water.length; cell += 1) {
    if (field.water[cell] === Water.Lake) lakes += 1;
    if (field.water[cell] === Water.Ocean) ocean += 1;
  }

  log(
    `  ${field.rivers.segments.length} runs of river from ${heads.length} heads, ` +
      `${intoLakes} of them into lakes; ${lakes} cells of lake, ${ocean} of sea; ` +
      `around the middle, ${onRivers.length} of ${around.length} parcels are river and ` +
      `${banks.length} are bank`,
  );

  const checks: [string, boolean][] = [
    ['the field is cut at half a parcel', Math.abs(FIELD * 2 - PARCEL) < 1e-9],
    ['every river reaches the sea or a lake', stranded === 0],
    ['no water runs uphill', climbed === 0],
    ['a world has rivers at all', field.rivers.segments.length > 200 && heads.length > 20],
    ['a world has lakes', lakes > 0],
    ['a river carries what it takes to be one', riversCarryWater],
    ['a tile the water runs through takes a well', wellsAreSited && wellsGoOnBanks],
    ['outside the claim a bank is refused for the claim, not the ground', banksOutsideRefusedForTheClaim],
    ['dry ground refuses one', wellsRefusedOnDry],
    ['a tile beside fresh water has water', besideWater.length > 0 && shoresGiveWater],
    ['a tile with only the sea beside it does not', saltOnly.length > 0 && seaGivesNothing],
    ['a river wide enough to stand in is water', riversBlock],
    ['no hearth is set in the water', nothingFoundedInWater],
    ['nobody walks out into the water', noWalkInWater],
    ['nothing is built in the water', nothingBuiltInWater],
    ['the same seed builds the same world', sameGround && sameRivers],
  ];

  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-7',
    title: 'Water',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `${field.rivers.segments.length} runs of river, ${banks.length} banks to put a well on, ${lakes} cells of lake`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

/** Every cell a river rises in: it carries a river, and nothing that feeds it does. */
function riverHeads(field: ReturnType<typeof fieldFor>): number[] {
  const { grid } = field;
  const fed = new Uint8Array(field.rivers.of.length);

  for (let cell = 0; cell < field.rivers.of.length; cell += 1) {
    if (field.rivers.of[cell] === 0) continue;
    const into = field.into[cell]!;
    if (into >= 0) fed[into] = 1;
  }

  const heads: number[] = [];
  for (let cell = 0; cell < field.rivers.of.length; cell += 1) {
    if (field.rivers.of[cell] !== 0 && fed[cell] !== 1) heads.push(cell);
  }

  void grid;
  return heads;
}

export function runLevel8(log: Logger): LevelResult {
  log(header('LEVEL 8 — Work: the ground gives nothing until a villager works it'));

  // Left alone, a land work draws nothing however long it stands: the ground is not a tap.
  const idle = harness();
  for (let tick = 1; tick <= 600; tick += 1) processBuilding(idle.bank, tick);
  const unworkedDrewNothing = idle.bank.producedTotal === 0;

  const run = harness();
  let workingOffMap = true;
  let oneWorkerEach = true;
  let withinCrew = true;
  for (let i = 0; i < 10000; i += 1) {
    const report = run.engine.tick();
    run.events.push(...report.events);

    const inside = new Map<string, number>();
    for (const carrier of run.settlement.carriers.values()) {
      if (carrier.state !== CarrierState.Working) continue;
      const site = run.settlement.buildings.get(carrier.atId);
      // Inside the building, not out on a path: that is what lets the map hide it.
      if (carrier.trail.length > 0 || !site) workingOffMap = false;
      // A shift at a land work is one villager drawing a batch; a watch at a rig is a crew,
      // and a kiln takes a second stoker. Counted apart, because they are different errands.
      if (site && carrier.job?.kind === 'work' && groundWork(site)) {
        inside.set(carrier.atId, (inside.get(carrier.atId) ?? 0) + 1);
      } else if (site && carrier.job?.kind === 'tend' && site.slots[carrier.job.slot ?? 0]?.rig) {
        const key = `rig:${carrier.atId}#${carrier.job.slot ?? 0}`;
        const crew = (inside.get(key) ?? 0) + 1;
        inside.set(key, crew);
        if (crew > (site.slots[carrier.job.slot ?? 0]?.rig?.crew.max ?? 0)) withinCrew = false;
      } else {
        workingOffMap = false;
      }
    }
    for (const [where, count] of inside) {
      if (!where.startsWith('rig:') && count > 1) oneWorkerEach = false;
    }
  }

  /**
   * The first whole shift at a site: the batch one villager handed over at the end of it, all in
   * the one tick, and what that villager did next.
   */
  const firstShift = (site: Building) => {
    const made = run.events.filter((event) => event.kind === 'produced' && event.buildingId === site.id);
    const worker = made[0]?.carrierId;
    const shift = [];
    for (const event of made) {
      if (event.carrierId !== worker) break;
      if (event.tick !== made[0]!.tick) break;
      shift.push(event);
    }
    const last = shift[shift.length - 1];
    const next = last
      ? run.events.find(
          (event) =>
            event.carrierId === worker && event.tick > last.tick && event.kind !== 'produced',
        )
      : undefined;
    return { shift, next };
  };

  const checks: [string, boolean][] = [
    ['an unworked dig draws nothing', unworkedDrewNothing],
    ['a well bucket takes five seconds', landWorkById('well')?.batch === 1 && landWorkById('well')?.ticks === 50],
    ['the dig gives five loads in ten seconds', landWorkById('digging')?.batch === 5 && landWorkById('digging')?.ticks === 100],
    ['the woodcutter gives ten logs in fifteen', landWorkById('woodcutter')?.batch === 10 && landWorkById('woodcutter')?.ticks === 150],
    ['a worker is never out on the map while working', workingOffMap],
    ['one villager works a land work at a time', oneWorkerEach],
    ['a rig takes a crew, and never more than it has room for', withinCrew],
  ];

  // The reed bed and the bank dig, because those are the two the town actually works: with no
  // mud mixer in the chapter there is nothing yet that *wants* Water or Dirt, so a well and a
  // dig stand idle however long you watch — and a shift is only ever offered when somebody
  // wants what it would draw. What a well buys is hours, and level 1 is where that is asserted.
  for (const site of [run.reedBed, run.bank]) {
    const work = groundWork(site)!;
    const { shift, next } = firstShift(site);
    log(
      `  ${labelOf(site)}: ${shift.length} × ${work.item} at once after ${work.ticks} ticks, ` +
        `then ${next ? `${next.kind} of ${next.item} at ${next.buildingId === site.id ? 'the same site' : next.buildingId}` : 'nothing'}`,
    );
    checks.push([`one shift at the ${labelOf(site)} yields the batch`, shift.length === work.batch]);
    checks.push([
      `the ${labelOf(site)}'s worker carries out what it drew, unless a need comes first`,
      next?.kind === 'tended' || (next?.kind === 'pickup' && next.buildingId === site.id && next.item === work.item),
    ]);
  }

  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-8',
    title: 'Work',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `${run.events.filter((event) => event.kind === 'produced' && event.carrierId).length} units drawn by hand in 1500 ticks`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

export function runLevel9(log: Logger): LevelResult {
  log(header('LEVEL 9 — Claim: every building holds the ground round it, and stones mark the edge'));
  const run = harness();
  const { world, settlement } = run;
  const hearth = settlement.buildings.get(settlement.hearthId)!;
  const centre = parcelOf(world.seed, hearth.cellId).site;
  // Any of the chapter's own buildings will do here; what is being tested is the claim.
  const mixer = designFrom(world, LEAN_TO_ID);

  const before = claimOf(world, settlement);
  const held = new Set(before);

  // Building at the edge pushes the edge out: the free claimed parcel furthest from the fire.
  const edge = freeParcelsNear(world, centre, HEARTH_REACH * PARCEL * 1.6)
    .filter((id) => held.has(id) && canBuild(world, settlement, id, mixer).ok)
    .sort((a, b) => distance(parcelOf(world.seed, b).site, centre) - distance(parcelOf(world.seed, a).site, centre))[0];
  const outpost = edge ? placeBuilding(world, settlement, edge, mixer) : undefined;
  const grown = claimOf(world, settlement);
  const gained = grown.filter((id) => !held.has(id));
  const beyond = freeParcelsNear(world, centre, HEARTH_REACH * PARCEL * 3).find((id) => !new Set(grown).has(id));
  const outside = beyond ? canBuild(world, settlement, beyond, mixer) : undefined;

  // Razed, the ground it held goes with it — the claim is the buildings, nothing kept beside them.
  if (outpost) raze(world, settlement, outpost.id);
  const shrunk = claimOf(world, settlement);
  if (edge) placeBuilding(world, settlement, edge, mixer);

  // Stones at a steady pace: consecutive stones along a run are the spacing apart, give or take
  // the corners a straight line between them cuts.
  const stones = claims(world).stones.get(settlement.id) ?? [];
  const gaps = stones.slice(1).map((stone, i) => distance(stone, stones[i]!));
  const steady = gaps.filter((gap) => gap >= STONE_SPACING * 0.6 && gap <= STONE_SPACING * 1.05).length;

  // A neighbour: refused where its reach would cut into this claim, founded beyond it — and where
  // the two meet, each parcel goes to the nearer building.
  const sites = freeParcelsNear(world, centre, HEARTH_REACH * PARCEL * 5).map((id) => parcelOf(world.seed, id));
  const crowding = sites.filter((p) => new Set(claimOf(world, settlement)).has(p.id) || distance(p.site, centre) <= HEARTH_REACH * PARCEL * 1.5);
  const crowdingRefused = crowding.length > 0 && crowding.every((p) => !canFound(world, p.id).ok);
  const clear = sites.find((p) => canFound(world, p.id).ok);
  const neighbour = clear ? foundSettlement(world, clear.id) : undefined;
  let nearestWins = true;
  if (neighbour) {
    // Nearest among the buildings that *reach* the parcel: a hearth reaches further than the rest,
    // so a workshop a little nearer but out of its reach does not take ground the hearth holds.
    const all = [...world.settlements.values()].flatMap((town) =>
      [...town.buildings.values()].map((b) => ({
        town: town.id,
        site: parcelOf(world.seed, b.cellId).site,
        reach: (b.id === town.hearthId ? HEARTH_REACH : BUILDING_REACH) * PARCEL,
      })),
    );
    for (const town of [settlement, neighbour]) {
      for (const id of claimOf(world, town)) {
        const site = parcelOf(world.seed, id).site;
        const reaching = all.filter((b) => distance(b.site, site) <= b.reach);
        const nearest = reaching.reduce((a, b) => (distance(b.site, site) < distance(a.site, site) ? b : a));
        if (nearest.town !== town.id) nearestWins = false;
      }
    }
  }
  const mine = new Set(claimOf(world, settlement));
  const shared = neighbour ? claimOf(world, neighbour).filter((id) => mine.has(id)).length : -1;

  log(`  claim ${before.length} parcels, ${grown.length} with a building at its edge (+${gained.length}), ${shrunk.length} once razed`);
  log(`  ${stones.length} stones, ${steady} of ${gaps.length} steps at the spacing; outside: ${outside?.reason}`);

  const checks: [string, boolean][] = [
    ['the hearth and every building stand in the claim', [...settlement.buildings.values()].every((b) => held.has(b.cellId) || b.cellId === edge)],
    ['a building at the edge pushes the edge out', outpost !== undefined && gained.length > 0],
    ['razing it gives the ground back exactly', shrunk.join() === before.join()],
    ['outside the claim nothing goes up, for the claim', outside?.ok === false && outside.reason.includes('claim')],
    ['the stones stand at a steady pace', gaps.length > 10 && steady / gaps.length > 0.8],
    ['a hearth may not be set where it would cut into a claim', crowdingRefused],
    ['beyond that, a neighbour may be founded', neighbour !== undefined],
    ['where two towns meet, ground goes to the nearer building', nearestWins],
    ['two claims never share a parcel', shared === 0],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-9',
    title: 'Claim',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `${before.length} parcels held, +${gained.length} for a building at the edge, ${stones.length} stones`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

export function runLevel10(log: Logger): LevelResult {
  log(header('LEVEL 10 — Clearing: a building is placed, then its site is felled and dug by hand'));
  const run = harness();
  const { world, settlement } = run;
  const hearth = settlement.buildings.get(settlement.hearthId)!;
  // The bank dig rather than the earth dig: this level is about a site being prepared before
  // it is used, and it needs a building the town then actually works. Nothing in the chapter
  // wants Dirt yet, so an earth dig is cleared and then stands there — which would make the
  // last check below a test of dispatch's priorities rather than of clearing.
  const dig = run.bank;
  const needed = dig.clearing?.needed ?? 0;

  // What the ground costs to clear, by what grows on it: a forest site against a meadow one.
  const sites = freeParcelsNear(world, MIDDLE, 400).map((id) => parcelOf(world.seed, id));
  const forest = sites.find((p) => p.biome === Biome.Forest && p.neighbors.every((n) => parcelOf(world.seed, n).biome === Biome.Forest));
  const meadow = sites.find((p) => p.biome === Biome.Meadow && p.neighbors.every((n) => parcelOf(world.seed, n).biome === Biome.Meadow));
  const forestCost = forest ? clearingFor(world, forest.id).needed : 0;
  const meadowCost = meadow ? clearingFor(world, meadow.id).needed : 0;
  // A site with nothing growing on it is dug and levelled, never felled.
  const bare = sites.find((p) => clearingFor(world, p.id).felling === 0);
  const bareWork = bare ? clearingFor(world, bare.id) : undefined;
  const forestWork = forest ? clearingFor(world, forest.id) : undefined;

  play(run, 10000, () => {});
  const cleared = run.events.find((e) => e.kind === 'cleared' && e.buildingId === dig.id);
  const usedEarly = run.events.some(
    (e) => e.buildingId === dig.id && e.kind !== 'cleared' && (!cleared || e.tick < cleared.tick),
  );
  const usedAfter = run.events.some((e) => e.buildingId === dig.id && e.kind === 'produced' && cleared && e.tick > cleared.tick);
  log(`  the dig needed ${needed} ticks of clearing, done on tick ${cleared?.tick ?? 'never'}; forest site ${forestCost}, meadow ${meadowCost}`);

  const checks: [string, boolean][] = [
    ['a building placed waits to be cleared', needed > 0],
    ['the hearth is up the moment it is set', hearth.clearing === null],
    ['a forest is more work to clear than a meadow', forestCost > meadowCost && meadowCost > 0],
    ['a site with no trees is only dug, never felled', bareWork !== undefined && bareWork.felling === 0 && bareWork.needed > 0],
    ['every site is dug as well as felled', forestWork !== undefined && forestWork.needed > forestWork.felling && forestWork.felling > 0],
    ['nothing is drawn or carried at a site before it is cleared', !usedEarly],
    ['a villager clears it, and it takes the work it needs', cleared !== undefined && cleared.tick >= needed],
    ['cleared, it is used', usedAfter],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-10',
    title: 'Clearing',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `dig cleared on tick ${cleared?.tick} after ${needed} ticks of felling; forest ${forestCost}, meadow ${meadowCost}`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

export function runLevel11(log: Logger): LevelResult {
  log(header('LEVEL 11 — Footpaths: nobody lays a road; walking wears one'));
  const run = harness();
  const { world, settlement } = run;
  const hearth = settlement.buildings.get(settlement.hearthId)!;

  // Stretched out, so there are walks long enough to wear a path along: a camp at the edge of
  // the claim, then another at the edge that one pushed out.
  let far = run.woodcutter;
  for (let i = 0; i < 2; i += 1) {
    const edge = claimOf(world, settlement)
      .filter((id) => canBuild(world, settlement, id, workOf('forage-camp')).ok)
      .sort((a, b) => distance(parcelOf(world.seed, b).site, hearth.position) - distance(parcelOf(world.seed, a).site, hearth.position))[0];
    if (edge) far = placeBuilding(world, settlement, edge, workOf('forage-camp'));
  }

  // Roofs, because a town is as big as the beds it has built and three people never walk far
  // enough from the fire to wear anything: dispatch takes the nearest work it can, so the band
  // has to be big enough that somebody is sent to the far end of the claim.
  for (let i = 0; i < 3; i += 1) {
    const spot = claimOf(world, settlement).find((id) =>
      canBuild(world, settlement, id, designFrom(world, LEAN_TO_ID)).ok,
    );
    if (spot) placeBuilding(world, settlement, spot, designFrom(world, LEAN_TO_ID));
  }

  // Cleared by hand. This level is about the walking, and a band that spends most of its day on
  // its own survival (`needs.ts`) would still be felling these when the ground it had already
  // worn had grown back — which measures the clearing rather than the paths.
  for (const building of settlement.buildings.values()) {
    building.clearing = null;
    building.state = BuildingState.Idle;
  }

  const fresh = route(world, hearth.cellId, far.cellId);
  const freshCost = fresh ? routeCost(world, fresh) : Infinity;
  // A path is worn by walking, and the band spends most of its day on its own survival
  // (`needs.ts`), so it takes a good many days of them to tread one in. Not longer, though:
  // a town that has finished its errands stands still, and ground nobody walks grows back —
  // run this past the point the work runs out and the paths measured here fade away again.
  play(run, 6000, () => {});

  const worn = [...world.wear.keys()];
  const showing = worn.filter((id) => wornness(world, id) >= 0.1);
  const again = route(world, hearth.cellId, far.cellId);
  const wornCost = fresh ? routeCost(world, fresh) : Infinity;
  // Whether a walk keeps to the ground the band's own errands wore, so it is measured to the
  // building they go to most and not to the furthest one placed: a camp whose crate is
  // full is left alone, and nothing wears a way to a place nobody goes — that is there being no
  // path, not a walk failing to follow one. The two ends are left out too. Nobody walks into a
  // building (`builtMiddles`), so the middle of the hearth and the middle of the place being
  // walked to are never worn, and counting them capped the answer at whatever share of a short
  // route the two of them happen to be.
  const busiest = [...settlement.buildings.values()]
    .filter((b) => b.id !== hearth.id)
    .sort((a, b) => b.producedTotal - a.producedTotal)[0];
  const toward = busiest ? route(world, hearth.cellId, busiest.cellId) : null;
  const between = toward ? toward.slice(1, -1) : [];
  const onPaths =
    between.length > 0 ? between.filter((id) => (world.wear.get(id) ?? 0) > 0).length / between.length : 0;

  const best = worn.reduce((a, b) => ((world.wear.get(b) ?? 0) > (world.wear.get(a) ?? 0) ? b : a), worn[0] ?? '');
  const quicker = best ? paceAt(world, best) : 0;
  const steps = world.wear.get(best) ?? 0;
  const resting = new Map(world.wear);
  world.wear.set(best, 0);
  world.wear.delete(best);
  const unworn = best ? paceAt(world, best) : 0;
  world.wear = resting;

  // Left alone, it grows back: enough fading to outlast the most-worn node empties the ground.
  const most = Math.max(...world.wear.values());
  for (let i = 0; i < most; i += 1) fadeWear(world);
  const grownBack = world.wear.size === 0;

  // Nobody wades. A river is a ribbon narrower than the gap between two sites, so a step can
  // have dry ground at both ends and the water running between them — which is how the walks
  // used to cross rivers. The walk goes round, or there is no walk.
  const banks = cellsIn(world.seed, PARCEL, {
    minX: hearth.position.x - PARCEL * 10,
    maxX: hearth.position.x + PARCEL * 10,
    minY: hearth.position.y - PARCEL * 10,
    maxY: hearth.position.y + PARCEL * 10,
  }).filter((parcel) => !isWater(parcel.biome));

  let opposite: [CellId, CellId] | null = null;
  for (const parcel of banks) {
    for (const other of parcel.neighbors) {
      const across = banks.find((p) => p.id === other);
      if (!across || !waterBetween(world.seed, parcel.site, across.site)) continue;
      opposite = [parcel.id, across.id];
      break;
    }
    if (opposite) break;
  }

  const acrossWater = opposite ? route(world, opposite[0], opposite[1]) : null;
  const wades = (walk: readonly string[]): boolean =>
    walk.some((id, i) => i > 0 && waterBetween(world.seed, positionOf(world, walk[i - 1]!), positionOf(world, id)));
  const roundAbout =
    opposite !== null &&
    (acrossWater === null ||
      (!wades(acrossWater) &&
        acrossWater.length > 2 &&
        routeCost(world, acrossWater) >
          distance(parcelOf(world.seed, opposite[0]).site, parcelOf(world.seed, opposite[1]).site)));

  const everyStepDry = worn.every((id) =>
    neighbours(world, id).every((next) => !waterBetween(world.seed, positionOf(world, id), positionOf(world, next))),
  );
  const noneWade = again !== null && !wades(again);

  log(`  two banks a step apart: ${opposite ? `${opposite[0]} to ${opposite[1]}` : 'none near the town'} — ${acrossWater ? `${acrossWater.length} nodes round` : 'no way round'}`);
  log(`  ${worn.length} nodes stepped on, ${showing.length} worn enough to show; the most-worn ${steps} steps`);
  log(`  hearth to the furthest dig (${fresh?.length ?? 0} nodes): ${freshCost.toFixed(1)} on fresh ground, ${wornCost.toFixed(1)} once worn; the walk to the busiest place ${(onPaths * 100).toFixed(0)}% on worn ground`);

  const checks: [string, boolean][] = [
    ['walking wears the ground', worn.length > 0],
    // A path network and not a smudge — and nearly everything stepped on has been trodden into
    // view. Not a fixed count of nodes: how many a town wears is how many places it has to walk
    // between, and a town that holds eight of each thing has few. The odd walk to drink at the
    // bank or pick berries off open ground leaves a faint side trail, so not every node.
    ['enough of it is worn to show as paths', showing.length >= 8 && showing.length >= worn.length * 0.85],
    ['a worn way is cheaper to walk than fresh ground', wornCost < freshCost],
    ['later walks keep to the worn ground', onPaths > 0.5],
    ['a worn path is walked faster', quicker > unworn],
    ['left alone, the paths grow back', grownBack],
    ['a step never crosses water', everyStepDry],
    ['the walks taken never cross water', noneWade],
    ['two banks a step apart are walked round, or not at all', roundAbout],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-11',
    title: 'Footpaths',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `${showing.length} nodes worn into paths; the walk out ${freshCost.toFixed(0)} → ${wornCost.toFixed(0)}`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

export function runLevel12(log: Logger): LevelResult {
  log(header('LEVEL 12 — Saving: a world written down and read back is the same world'));
  const run = harness();
  play(run, 600, () => {});

  const written = JSON.parse(JSON.stringify(saveWorld(run.world, run.engine.tickCount))) as unknown;
  const read = restoreWorld(written, run.world.seed);
  if (!read) {
    return { id: 'level-12', title: 'Saving', passed: false, detail: 'the save would not read back' };
  }

  const restored = new LogisticsEngine(read.world);
  restored.tickCount = read.tick;

  const atRest = run.engine.traceHash() === restored.traceHash();

  // And it has to go on being the same world: a carrier restored mid-errand walks the rest of it.
  play(run, 200, () => {});
  for (let i = 0; i < 200; i += 1) restored.tick();
  const afterwards = run.engine.traceHash() === restored.traceHash();

  const was = run.world.settlements.get(run.settlement.id);
  const now = read.world.settlements.get(run.settlement.id);
  const sameTown =
    was !== undefined &&
    now !== undefined &&
    was.buildings.size === now.buildings.size &&
    was.carriers.size === now.carriers.size &&
    was.name === now.name &&
    was.hearthId === now.hearthId;
  const sameLibrary = run.world.library.size === read.world.library.size;
  const sameGround = run.world.wear.size === read.world.wear.size;

  // A save from another version, or one somebody has edited, is refused rather than half-read.
  const refusesOtherSeeds = restoreWorld(written, run.world.seed + 1) === null;
  const refusesOtherVersions =
    restoreWorld({ ...(written as object), version: -1 }, run.world.seed) === null;

  log(`  ${now?.buildings.size ?? 0} buildings, ${now?.carriers.size ?? 0} carriers and ${read.world.wear.size} worn nodes read back on tick ${read.tick}`);
  log(`  hash ${run.engine.traceHash().toString(16)} after 200 more ticks on each side`);

  const checks: [string, boolean][] = [
    ['the restored world traces identically', atRest],
    ['and goes on tracing identically', afterwards],
    ['the town comes back whole', sameTown],
    ['the library comes back whole', sameLibrary],
    ['the worn ground comes back', sameGround],
    ['a save for another seed is refused', refusesOtherSeeds],
    ['a save from another version is refused', refusesOtherVersions],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-12',
    title: 'Saving',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `read back on tick ${read.tick} and still on the same trace 200 ticks later`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

function runLevel14(log: Logger): LevelResult {
  log(header('LEVEL 14 — The models: the fire reaches what the book says it reaches'));

  // Each rig at the best run params its masonry allows, which is what a method is checked against.
  const ceilings = RIG_IDS.map((id) => ({ id, T: envelopeOf(RIGS[id]).T }));
  for (const { id, T } of ceilings) {
    log(`  ${RIGS[id].label.padEnd(15)} tops out at ${String(T).padStart(5)} °C — ${glowOf(T).name}`);
  }
  const expected: Record<RigId, number> = { openFire: 506, pitFire: 697, updraft: 1050, downdraft: 1197 };
  const ceilingsHold = ceilings.every(({ id, T }) => T === expected[id]);

  // A pit firing cannot reach ceramic the way a kiln can, and a kiln on charcoal beats one on
  // wood — the ladder the whole chapter is built on.
  const ladder =
    expected.openFire < expected.pitFire &&
    expected.pitFire < expected.updraft &&
    expected.updraft < expected.downdraft;
  const kilnNeedsCharcoal = envelopeOf(RIGS.updraft).fuel === 'charcoal';

  // The air peak: a kiln on charcoal at a fixed charge rate is hottest at one damper, and both
  // sides of it are colder for different reasons. Below, the fuel is starved and the volatiles
  // carry the heat up the flue; above, every extra litre of cold air has to be heated.
  const potRate = 1.2;
  const atDamper = (damper: number) =>
    fire({ ...RIGS.updraft.build, fuel: 'charcoal', damper, fuelRate: potRate });
  let peak = { damper: 0, T: 0 };
  for (let step = 0; step <= 400; step += 1) {
    const damper = 0.02 + (step * 0.98) / 400;
    const out = atDamper(damper);
    if (!out.starved && out.T > peak.T) peak = { damper: Math.round(damper * 1000) / 1000, T: out.T };
  }
  log(`  the air peak for pots sits at damper ${peak.damper} — ${peak.T} °C, ${glowOf(peak.T).name}`);
  const peakWhereExpected = Math.abs(peak.damper - 0.6) < 0.02 && peak.T === 918;
  const starvedBelow = atDamper(peak.damper - 0.05).starved;
  const chilledAbove = !atDamper(peak.damper + 0.2).starved && atDamper(peak.damper + 0.2).T < peak.T;

  // Charcoal is not a free upgrade: twice the energy of wood, but nearly twice the air. Run it
  // on a rig without the draught to feed it and it comes out colder than the wood it replaced.
  const woodPit = fire({ ...RIGS.pitFire.build, fuel: 'wood', damper: 1, fuelRate: 1.5 });
  const charPit = fire({ ...RIGS.pitFire.build, fuel: 'charcoal', damper: 1, fuelRate: 1.5 });
  log(`  the pit on wood reaches ${woodPit.T} °C; on charcoal, ${charPit.T} °C and ${charPit.starved ? 'smoking' : 'clean'}`);
  const charcoalPunishes = charPit.T < woodPit.T && charPit.starved && !woodPit.starved;

  // The clamp's one knob disagrees with itself: open the vents and the pile runs hotter, gives
  // proper charcoal, and gives less of it.
  const shut = char({ wood: 5, vent: 0.1 });
  const open = char({ wood: 5, vent: 0.5 });
  log(`  the clamp shut gives ${shut.charcoal} of ${shut.grade} (${shut.smoke} smoke); open, ${open.charcoal} of ${open.grade} (${open.smoke})`);
  const charTrades =
    shut.grade === 'brands' && open.grade === 'charcoal' && open.charcoal < shut.charcoal && open.T > shut.T;

  // Clay: the same clay at the same peak, taken up fast and taken up slow.
  const slow = clay({ temper: 0.2, dryRate: 0.3, rampLow: 0.2, ramp573: 0.2, peak: 960, hold: 35 });
  const fast = clay({ temper: 0.2, dryRate: 0.3, rampLow: 0.95, ramp573: 0.95, peak: 960, hold: 35 });
  log(`  taken up slowly ${Math.round(slow.loss * 100)}% of the ware is lost; rushed, ${Math.round(fast.loss * 100)}%`);
  const scheduleMatters = fast.loss > slow.loss * 2 && slow.grade === fast.grade;
  // A hard pot carries more water per trip, which is how a firing schedule decides who walks.
  const soft = clay({ peak: 700, hold: 10 });
  const hard = clay({ peak: 1050, hold: 45 });
  const hardnessCarries = hard.carries > soft.carries && hard.tripsBeforeBreaking > soft.tripsBeforeBreaking;

  // Knapping: the trade is edge quality against how many edges one core gives.
  const hard3 = knap({ hammer: 'hard' });
  const antler = knap({ hammer: 'antler' });
  log(`  a hard hammer takes ${hard3.fromOneCore} ${hard3.grade} flakes off a core; antler, ${antler.fromOneCore} ${antler.grade}`);
  const knapTrades =
    hard3.ok &&
    antler.ok &&
    (antler.ratio ?? 0) > (hard3.ratio ?? 0) &&
    (antler.fromOneCore ?? 0) < (hard3.fromOneCore ?? 0);
  const overhangSlides = !knap({ angle: 95 }).ok;

  // Pure: no clock, no RNG. The same params twice must give the same answer to the last digit.
  const twice =
    JSON.stringify(fire({ ...RIGS.updraft.build, fuel: 'charcoal', damper: 0.6, fuelRate: 1.2 })) ===
      JSON.stringify(fire({ ...RIGS.updraft.build, fuel: 'charcoal', damper: 0.6, fuelRate: 1.2 })) &&
    JSON.stringify(clay({ peak: 900 })) === JSON.stringify(clay({ peak: 900 }));

  const checks: [string, boolean][] = [
    ['every rig reaches the ceiling the book quotes', ceilingsHold],
    ['the four rigs make a ladder', ladder],
    ['a kiln is at its best on charcoal', kilnNeedsCharcoal],
    ['air has a best setting, where the book says it is', peakWhereExpected],
    ['below the peak the fire is starved', starvedBelow],
    ['above it, cold air chills the chamber', chilledAbove],
    ['charcoal without draught is colder than the wood it replaced', charcoalPunishes],
    ['the clamp trades yield against carbon', charTrades],
    ['a firing is a schedule, not a temperature', scheduleMatters],
    ['a harder pot carries more and lasts longer', hardnessCarries],
    ['a long flake costs the core', knapTrades],
    ['a platform over 90° slides the blow off', overhangSlides],
    ['the models are pure', twice],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-14',
    title: 'The models',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `ceilings ${ceilings.map(({ T }) => T).join('/')} °C, air peaks at damper ${peak.damper}`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

/**
 * LEVEL 15 — the rig, the method and the queue, which are three things on purpose.
 *
 * The rig is capital: masonry on a floor, with an envelope its build params fix. The method is
 * knowledge: a recipe with its settings written down, living in the town's book and portable to
 * any rig that can take it. The queue is policy: an ordered list, scanned top to bottom, first
 * entry that can run wins.
 *
 * Everything asserted here is a consequence of keeping them apart — a rig refusing a method it
 * cannot get hot enough for, a queue falling through to the next entry when a material runs out,
 * a full entry being passed over so the first one starves nothing below it.
 */
function runLevel15(log: Logger): LevelResult {
  log(header('LEVEL 15 — Rig, method, queue: one fire, an ordered list, first that can run'));

  const run = harness();
  const hearth = run.settlement.buildings.get(run.settlement.hearthId);
  if (!hearth) throw new Error('a settlement with no hearth');
  const rig = rigAt(hearth);
  if (!rig) throw new Error('the hearth was founded without its fire');
  const book = run.settlement.book;

  // Founding hands over the fire and the one method the town is born knowing.
  // The basket first and the fire second, because until the town can carry water everybody
  // walks to the river for every drink and that is most of what the first age costs.
  const bornKnowing = linesFor(hearth, stationSlot(hearth)).join('>') === `${SEAL_METHOD}>${EMBERS_METHOD}`;
  log(`  the fire tops out at ${ceilingOf(rig)} °C`);

  // With no wood standing in it the queue has nothing it can run, and says so rather than stalling
  // silently — a rig that refuses without words is the bug this layer exists to prevent.
  const cold = scanQueue(rig, book, hearth, stationSlot(hearth));
  log(`  cold: ${cold.refused.map((r) => `${r.methodId} — ${r.why}`).join('; ') || 'nothing refused'}`);
  const refusesForWood = cold.method === null && cold.refused[0]?.kind === 'inputs';

  // Lay in wood by hand. The queue now runs, and a batch of embers comes out of the fire.
  depositHopper(hearth, ItemType.Deadwood, 8);
  const banked = scanQueue(rig, book, hearth, stationSlot(hearth)).method;
  const ticksPerBatch = banked ? batchTicks(rig, banked) : 0;
  log(`  with 8 deadwood standing in it the fire takes "${banked?.label}", ${ticksPerBatch} ticks to the batch`);

  let firstEmber = 0;
  for (let tick = 1; tick <= 400 && firstEmber === 0; tick += 1) {
    if (runRig(hearth, stationSlot(hearth), book, true).produced.length > 0) firstEmber = tick;
  }
  const emberMade = firstEmber > 0 && storedStock(hearth, ItemType.Embers) > 0;
  log(`  the first embers came out on tick ${firstEmber}`);

  // The one knob: stoking harder shortens the batch, and spends the woodpile at the same pace.
  const method = methodById(book, EMBERS_METHOD);
  if (!method) throw new Error('the book lost its one method');
  const paces = [CHARGE_LOW, CHARGE_STEADY, CHARGE_HIGH].map((charge) =>
    batchTicks(rig, { ...method, run: { ...method.run, charge } }),
  );
  const piles = [CHARGE_LOW, CHARGE_STEADY, CHARGE_HIGH].map(
    (charge) => costOf(rig, { ...method, run: { ...method.run, charge } })[0]?.amount ?? 0,
  );
  log(`  banked ${paces[0]} ticks for ${piles[0]} deadwood · steady ${paces[1]}/${piles[1]} · roaring ${paces[2]}/${piles[2]}`);
  const knobBites = (paces[0] ?? 0) > (paces[1] ?? 0) && (paces[1] ?? 0) > (paces[2] ?? 0);
  // And it costs. Without this the knob has a strictly best setting and nothing to decide:
  // roaring was faster and free, so banked was never the answer to anything.
  const knobCosts = (piles[0] ?? 0) < (piles[1] ?? 0) && (piles[1] ?? 0) < (piles[2] ?? 0);

  // The stop. Fed all it can take, the fire makes embers until there is no room for another,
  // and then refuses in words — a full shelf is the only thing that stops an entry.
  const capacity = capacityOf(hearth);
  for (let tick = 1; tick <= 4000; tick += 1) {
    depositHopper(hearth, ItemType.Deadwood, roomFor(hearth, ItemType.Deadwood));
    runRig(hearth, stationSlot(hearth), book, true);
  }
  const embers = storedStock(hearth, ItemType.Embers);
  log(`  fed all it could take the fire stopped at ${embers} embers, the shelf holding ${capacity}`);
  const stoppedAtCapacity = embers === capacity;
  const stoppedBecauseFull =
    scanQueue(rig, book, hearth, stationSlot(hearth)).refused.find((r) => r.methodId === EMBERS_METHOD)?.kind === 'full';

  // Fall-through. An entry that is full is passed over, and the one below it runs: a second
  // entry that can run must be taken while the first stands refused for want of room.
  const scorch: Method = {
    id: 'scorch',
    label: 'Scorch sticks',
    process: 'fire',
    inputs: [{ item: ItemType.Dirt, amount: 1 }],
    outputs: [{ item: ItemType.Mud, amount: 1 }],
    run: { charge: CHARGE_HIGH, fuel: 'wood' },
    ticks: 10,
  };
  addMethod(book, scorch);
  setLines(hearth, stationSlot(hearth), [EMBERS_METHOD, scorch.id]);
  depositHopper(hearth, ItemType.Dirt, 4);
  const belowFull = scanQueue(rig, book, hearth, stationSlot(hearth));
  const fullFallsThrough =
    belowFull.method?.id === scorch.id && belowFull.refused[0]?.kind === 'full';
  log(`  with the embers full the queue takes "${belowFull.method?.label}" instead`);

  // Fall-through on heat. A second entry *above* the ember method, needing a heat this fire
  // cannot reach, must be passed over in plain words and the fire must go on working below it.
  const lime: Method = { ...scorch, id: 'burn-lime', label: 'Burn lime', ticks: 40, needsHeat: 1100 };
  addMethod(book, lime);
  setLines(hearth, stationSlot(hearth), [lime.id, EMBERS_METHOD]);
  withdraw(hearth, ItemType.Embers, capacity);

  const scan = scanQueue(rig, book, hearth, stationSlot(hearth));
  const envelopeRefusal = scan.refused.find((r) => r.methodId === lime.id);
  log(`  the kiln method is refused: ${envelopeRefusal?.why}`);
  const refusesOutOfEnvelope = envelopeRefusal?.kind === 'envelope';
  const fellThrough = scan.method?.id === EMBERS_METHOD;

  // And the scan is in declaration order, not by what is easiest: put the ember method on top
  // of an entry that *can* run and the top one is taken.
  setLines(hearth, stationSlot(hearth), [scorch.id, EMBERS_METHOD]);
  const topWins = scanQueue(rig, book, hearth, stationSlot(hearth)).method?.id === scorch.id;
  setLines(hearth, stationSlot(hearth), [EMBERS_METHOD, scorch.id]);
  const orderDecides = scanQueue(rig, book, hearth, stationSlot(hearth)).method?.id === EMBERS_METHOD;
  log(`  swapping the two entries over swaps which one the worker takes`);

  // A method is knowledge and is saved with the town; a rig is capital and is saved with the
  // building. Neither is derivable from anything else in the world.
  const saved = saveWorld(run.world, 100);
  const read = restoreWorld(JSON.parse(JSON.stringify(saved)), run.world.seed);
  const readHearth = read?.world.settlements.get(run.settlement.id)?.buildings.get(hearth.id);
  const readBook = read?.world.settlements.get(run.settlement.id)?.book;
  const bookKept = readBook?.methods.size === book.methods.size && readBook.methods.has(lime.id);
  const rigKept =
    readHearth !== undefined &&
    linesFor(readHearth, stationSlot(readHearth)).join('>') === linesFor(hearth, stationSlot(hearth)).join('>') &&
    rigAt(readHearth)?.spec === rig.spec;

  const checks: [string, boolean][] = [
    ['a town is founded knowing its first methods, on one rig', bornKnowing],
    ['a queue with nothing to work on refuses in plain words', refusesForWood],
    ['the fire banked with deadwood makes embers', emberMade],
    ['stoking harder shortens the batch', knobBites],
    ['and eats more of the woodpile for it', knobCosts],
    ['a rig stops when its output is full, and says so', stoppedAtCapacity && stoppedBecauseFull],
    ['and the entry below a full one runs', fullFallsThrough],
    ['a rig refuses a method it cannot get hot enough for', refusesOutOfEnvelope],
    ['and the queue falls through to the next entry', fellThrough],
    ['the scan is in declaration order', topWins && orderDecides],
    ['the book is saved with the town', bookKept],
    ['the rig is saved with the building', rigKept],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-15',
    title: 'Rig, method, queue',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `first embers on tick ${firstEmber}, stopped at ${capacity}, fell through a method out of envelope`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

/**
 * LEVEL 16 — needs, villager by villager.
 *
 * Each villager's thirst, hunger and rest run down on their own, and when one reaches its mark
 * the villager goes to see to it before taking any more work. Asserted: everybody drinks, eats
 * and sleeps; nobody goes long with a need unmet; nobody takes work while one is down; a store's
 * berries are a quicker meal than picking your own, and a roof a quicker night than the fire;
 * the forage camp turns up berries about one time in five; and needs cost time, never lives.
 */
/** Twenty days, long enough for the counts of a day to settle. */
const WATCHED = DAY_TICKS * 20;

function runLevel16(log: Logger): LevelResult {
  log(header('LEVEL 16 — Needs: each villager drinks, eats and sleeps, and works in between'));

  const fresh = generateWorld(SEED);
  const dawnTown = foundBesideWater(fresh).settlement;
  const dryStart = !canHaul(dawnTown, ItemType.Water) && vesselsHeld(dawnTown) === 0;

  const run = harness();
  const { settlement } = run;
  const mudRegardless = canHaul(settlement, ItemType.Mud);
  const bankGivesMud = run.bank.yields.includes(ItemType.Mud);

  const watched = watchNeeds(run, WATCHED);
  const { errands } = watched;
  const by = (kind: string) => errands.filter((e) => e.kind === kind);
  const everyone = [...settlement.carriers.values()].every((carrier) =>
    ['drink', 'eat', 'sleep'].every((kind) => errands.some((e) => e.carrierId === carrier.id && e.kind === kind)),
  );
  log(`  ${by('drink').length} drinks, ${by('eat').length} meals, ${by('sleep').length} sleeps across ${settlement.carriers.size} villagers`);
  const perDay = (kind: string) => by(kind).length / settlement.carriers.size / (WATCHED / DAY_TICKS);
  log(`  a villager's day: ${perDay('drink').toFixed(1)} drinks, ${perDay('eat').toFixed(1)} meals, ${perDay('sleep').toFixed(1)} sleeps`);
  const paced =
    Math.abs(perDay('drink') - 3) < 0.6 && Math.abs(perDay('eat') - 2) < 0.5 && Math.abs(perDay('sleep') - 1) < 0.4;
  log(`  the longest anybody went with a need unmet: ${watched.longestLow} ticks; work taken while one was down: ${watched.workedWhileLow}`);

  const storedMeals = by('eat').filter((e) => e.easy);
  const picked = by('eat').filter((e) => !e.easy);
  log(`  a meal out of a store: ${meanTicks(storedMeals)} ticks (${storedMeals.length}); picking your own: ${meanTicks(picked)} (${picked.length})`);
  const berriesQuicker = storedMeals.length > 0 && picked.length > 0 && meanTicks(storedMeals) < meanTicks(picked);

  const roofed = by('sleep').filter((e) => e.easy);
  const rough = by('sleep').filter((e) => !e.easy);
  log(`  a sleep under a roof: ${meanTicks(roofed)} ticks (${roofed.length}); by the fire: ${meanTicks(rough)} (${rough.length})`);
  const roofQuicker = roofed.length > 0 && rough.length > 0 && meanTicks(roofed) < meanTicks(rough);

  const found = run.events.filter((e) => e.kind === 'produced' && e.buildingId === run.woodcutter.id);
  const berries = found.filter((e) => e.item === ItemType.Berries).length;
  const share = found.length === 0 ? 0 : berries / found.length;
  log(`  the forage camp turned up ${berries} berries in ${found.length} finds (${Math.round(share * 100)}%)`);
  const poolHolds = found.length >= 20 && share > 0.08 && share < 0.35;

  const day = dayOf(settlement);
  const addsUp = Math.abs(Object.values(day).reduce((sum, h) => sum + h, 0) - DAY_HOURS) < 0.01;
  log(`  a day as watched: ${(Object.entries(day) as [string, number][]).map(([part, h]) => `${part} ${h.toFixed(1)}h`).join(' · ')}`);

  const nobodyDied = settlement.carriers.size === bedsIn(settlement) && settlement.carriers.size >= 3;

  const checks: [string, boolean][] = [
    ['every villager drinks, eats and sleeps', everyone],
    ['about three drinks, two meals and a sleep in a day', paced],
    ['nobody goes half a day with a need unmet', watched.longestLow < DAY_TICKS / 2],
    ['nobody takes work while a need is down to its mark', watched.workedWhileLow === 0],
    ['berries out of a store are a quicker meal than picking your own', berriesQuicker],
    ['a roof is a quicker night than the fire', roofQuicker],
    ['the forage camp turns up berries about one time in five', poolHolds],
    ['the watched day comes to fourteen hours', addsUp],
    ['nobody carries water before there is something to carry it in', dryStart],
    ['mud can be dug out of a bank regardless, which is the way out', mudRegardless && bankGivesMud],
    ['needs cost time, never lives', nobodyDied],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-16',
    title: 'Needs',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `${errands.length} needs seen to; the longest unmet ${watched.longestLow} ticks; berries ${Math.round(share * 100)}% of finds`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

export function runAllLevels(log: Logger): LevelResult[] {
  const levels = [runLevel1, runLevel3, runLevel4, runLevel5, runLevel6, runLevel7, runLevel8, runLevel9, runLevel10, runLevel11, runLevel12, runLevel14, runLevel15, runLevel16, runLevel17, runLevel18, runLevel19, runLevel20];
  const results = levels.map((level) => level(log));
  log('');
  for (const result of results) log(verdict(result.title, result.passed, result.detail));
  return results;
}
