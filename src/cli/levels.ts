import { PUSH_TICKS, STORAGE_CAPACITY, blockAt, designRadius, validateDesign } from '../sim/blocks.ts';
import {
  blocksOf,
  createBuilding,
  depositHopper,
  outputStock,
  processBuilding,
  storedStock,
  visibleBuffers,
} from '../sim/buildings.ts';
import { CARRIERS_FOR } from '../sim/carriers.ts';
import { buildableDesigns, canBuild, placeBuilding, raze } from '../sim/construction.ts';
import { HEARTH_DESIGN, HEARTH_DESIGN_ID, cloneDesign, emptyDesign } from '../sim/designs.ts';
import { LogisticsEngine } from '../sim/engine.ts';
import { distance, pointInPolygon } from '../sim/geometry.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { BUILDING_REACH, HEARTH_REACH, STONE_SPACING, claimOf, claims, inClaim } from '../sim/claims.ts';
import { clearingFor } from '../sim/clearing.ts';
import { isLandWork, landWorkById, paceOf } from '../sim/landWorks.ts';
import { removeDesign, retool, saveDesign } from '../sim/library.ts';
import { restoreWorld, saveWorld } from '../sim/save.ts';
import { FIT_TICKS, canFit, clearBlock, fitBlock, fittingFree, turnBlock } from '../sim/fitting.ts';
import { dockZone, zoneCornerOf } from '../sim/zones.ts';
import { cornerNode } from '../sim/footpaths.ts';
import { WORKS_DESIGN } from '../sim/works.ts';
import { landYield } from '../sim/markers.ts';
import { PARCEL, cellsIn, parcelAt, parcelOf } from '../sim/parcels.ts';
import { fadeWear, neighbours, paceAt, positionOf, route, routeCost, wornness } from '../sim/footpaths.ts';
import { biomeAt, nearestWater, riverRunsIn, terrainAt, waterBetween } from '../sim/terrain.ts';
import { FIELD } from '../sim/heightmap.ts';
import { RIVER_FLUX, Water } from '../sim/hydrology.ts';
import { buildField, fieldFor, isFresh, isWater } from '../sim/worldfield.ts';
import { Biome, BlockKind, BuildingState, CarrierState, Direction, ItemType } from '../sim/types.ts';
import type { Building, CellId, Design, Settlement, TickEvent } from '../sim/types.ts';
import type { GameWorld } from '../sim/world.ts';
import { buildingOn, canFound, foundSettlement, generateWorld } from '../sim/worldgen.ts';
import { header, renderTick, verdict } from './render.ts';

export interface LevelResult {
  id: string;
  title: string;
  passed: boolean;
  detail: string;
}

type Logger = (line: string) => void;

const SEED = 20261017;
/** Trace every Nth tick: a 900-tick haul printed in full is unreadable. */
const TRACE_EVERY = 60;
const MIDDLE: Vec2 = { x: 500, y: 350 };

interface Harness {
  world: GameWorld;
  engine: LogisticsEngine;
  settlement: Settlement;
  events: TickEvent[];
  well: Building;
  digging: Building;
  mixer: Building;
}

function workOf(id: string): Design {
  const work = landWorkById(id);
  if (!work) throw new Error(`there is no land work ${id}`);
  return work.design;
}

function designFrom(world: GameWorld, id: string): Design {
  const design = world.library.get(id);
  if (!design) throw new Error(`the library has no ${id}`);
  return design;
}

/** Free land near a point, nearest first, skipping anything already spoken for. */
function freeParcelsNear(world: GameWorld, centre: Vec2, reach: number): CellId[] {
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
 * A tile with water running through it, and somewhere free beside it to put the fire. Any ground
 * can be settled — a hearth needs nothing, and earth is under every parcel — but a town that is
 * to make mud has to be founded within walking distance of a bank.
 */
function foundBesideWater(world: GameWorld): { settlement: Settlement; water: CellId } {
  // Walk to the water first and look for a bank there, rather than sweeping the parcels of half
  // a continent: the lattice is built cell by cell, and a 400-unit square of it is forty
  // thousand Voronoi cells to answer a question the field can answer directly.
  const water = nearestWater(world.seed, MIDDLE) ?? MIDDLE;
  const banks = freeParcelsNear(world, water, 40).filter((id) =>
    landYield(world, id).includes(ItemType.Water),
  );

  for (const bank of banks) {
    const site = freeParcelsNear(world, parcelOf(world.seed, bank).site, 30).find((id) => id !== bank);
    if (!site) continue;
    return { settlement: foundSettlement(world, site), water: bank };
  }

  throw new Error('no water anywhere near the middle of the world');
}

/**
 * Raise the town the way a player would: a land work on each deposit, a mixer from the library
 * on bare ground, and dirt laid out to every one of them. Founding hands over a fire and nothing
 * else, so the whole of this is the player's work — and the levels' too.
 */
function raiseTheTown(world: GameWorld, settlement: Settlement, water: CellId) {
  const hearth = settlement.buildings.get(settlement.hearthId);
  if (!hearth) throw new Error('a settlement with no hearth');

  const well = placeBuilding(world, settlement, water, workOf('well'));

  const free = freeParcelsNear(world, hearth.position, 70).filter((id) =>
    canBuild(world, settlement, id, workOf('digging')).ok,
  );
  const digSite = free[0];
  const mixerSite = free[1];
  if (!digSite || !mixerSite) throw new Error('no free parcels for the dig and the mixer');

  const digging = placeBuilding(world, settlement, digSite, workOf('digging'));
  const mixer = placeBuilding(world, settlement, mixerSite, designFrom(world, 'mud-mixer'));

  return { well, digging, mixer };
}

function harness(): Harness {
  const world = generateWorld(SEED);
  const { settlement, water } = foundBesideWater(world);
  const raised = raiseTheTown(world, settlement, water);
  return { world, engine: new LogisticsEngine(world), settlement, events: [], ...raised };
}

function play(harness: Harness, ticks: number, log: Logger, trace = TRACE_EVERY): void {
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

export function runLevel1(log: Logger): LevelResult {
  log(header('LEVEL 1 — Intake: a villager draws water at the well, and it is carried away'));
  const run = harness();
  // Long enough for the well's site to be felled and dug first (`clearing.ts`).
  play(run, 600, log);

  const drawn = run.well.producedTotal;
  const pickup = firstEvent(run.events, { kind: 'pickup', item: ItemType.Water });
  const dropoff = firstEvent(run.events, { kind: 'dropoff', item: ItemType.Water });
  const walked = [...run.settlement.carriers.values()].every((carrier) => carrier.walked > 0);
  const passed = drawn > 0 && Boolean(pickup && dropoff) && walked;

  return {
    id: 'level-1',
    title: 'Intake',
    passed,
    detail: passed
      ? `well drew ${drawn} × Water, picked up on tick ${pickup?.tick}, delivered on tick ${dropoff?.tick}`
      : `drawn=${drawn} pickup=${pickup?.tick ?? 'never'} dropoff=${dropoff?.tick ?? 'never'} bothWalked=${walked}`,
  };
}

export function runLevel2(log: Logger): LevelResult {
  log(header('LEVEL 2 — Belts: one square a tick, however the run is drawn'));

  // A line of belts, declared *against* the flow on purpose: a run written in flow order would
  // carry an item end to end in one tick if the mover did not hold back what has just landed,
  // and the same run written backwards would crawl. Both have to take the same time.
  const line = emptyDesign('line', 'Line');
  line.blocks = [
    { kind: BlockKind.Output, x: 4, y: 2, facing: Direction.East, item: ItemType.Water },
    { kind: BlockKind.Transport, x: 3, y: 2, facing: Direction.East },
    { kind: BlockKind.Transport, x: 2, y: 2, facing: Direction.East },
    { kind: BlockKind.Input, x: 1, y: 2, facing: Direction.East, item: ItemType.Water },
  ];

  const world = generateWorld(SEED);
  const { settlement } = foundBesideWater(world);
  const hearth = settlement.buildings.get(settlement.hearthId);
  if (!hearth) throw new Error('a settlement with no hearth');

  const site = freeParcelsNear(world, hearth.position, 70).find(
    (id) => canBuild(world, settlement, id, line).ok,
  );
  if (!site) throw new Error('no parcel for the belt line');

  const building = placeBuilding(world, settlement, site, line);
  // Cleared by hand here: this level runs the building alone, with no villager to fell its site,
  // and what it is about is the belts.
  building.clearing = null;
  const squares = 3; // input → belt → belt → output: three hand-overs
  depositHopper(building, ItemType.Water, 1);

  let arrived = 0;
  for (let tick = 1; tick <= 40 && arrived === 0; tick += 1) {
    processBuilding(building, tick);
    if (outputStock(building, ItemType.Water) > 0) arrived = tick;
  }

  const expected = squares * PUSH_TICKS;
  log(`  the load crossed ${squares} squares in ${arrived} ticks (${PUSH_TICKS} per square)`);

  const checks: [string, boolean][] = [
    ['the load reaches the far door', arrived > 0],
    ['it takes a tick per square, not one tick for the run', arrived >= squares],
    ['it is no slower than the belt it rides', arrived <= expected + PUSH_TICKS],
    ['a belt square holds one thing at a time', blocksOf(building).every(({ state }) => (state.held?.amount ?? 0) <= 6)],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-2',
    title: 'Belts',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `${squares} squares in ${arrived} ticks`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

export function runLevel3(log: Logger): LevelResult {
  log(header('LEVEL 3 — Mud and the town store: what is made ends up in the bins by the fire'));
  const run = harness();
  play(run, 1000, log, 150);

  const hearth = run.settlement.buildings.get(run.settlement.hearthId);
  if (!hearth) throw new Error('a settlement with no hearth');

  const made = firstEvent(run.events, { kind: 'produced', item: ItemType.Mud });
  const stored = storedStock(hearth, ItemType.Mud);
  const stalled = run.events.filter((event) => event.kind === 'stalled');
  const bins = blocksOf(hearth).filter(({ block }) => block.kind === BlockKind.Storage);
  const fire = blocksOf(hearth).find(({ block }) => block.kind === BlockKind.Hearth);

  // Two warehouses and the hearth, with stock sitting in one of them and no reason for any of it
  // to move: a bin may feed a workshop, never another bin. Without that rule a load shuttles
  // between two stores for ever, each taking it in because nobody else wanted it.
  const still = generateWorld(SEED + 11);
  const quiet = foundBesideWater(still).settlement;
  const quietHearth = quiet.buildings.get(quiet.hearthId);
  const warehouse = emptyDesign('warehouse', 'Warehouse');
  warehouse.blocks = [
    { kind: BlockKind.Storage, x: 1, y: 2, facing: Direction.East },
    { kind: BlockKind.Storage, x: 2, y: 2, facing: Direction.East },
  ];

  const sites = freeParcelsNear(still, quietHearth?.position ?? MIDDLE, 60).filter((id) =>
    canBuild(still, quiet, id, warehouse).ok,
  );
  const first = placeBuilding(still, quiet, sites[0] ?? '', warehouse);
  const second = placeBuilding(still, quiet, sites[1] ?? '', warehouse);
  depositHopper(first, ItemType.Mud, 5);
  new LogisticsEngine(still).run(300);

  const hoarded = storedStock(first, ItemType.Mud);
  const leaked =
    storedStock(second, ItemType.Mud) + storedStock(quietHearth ?? first, ItemType.Mud);

  const checks: [string, boolean][] = [
    ['water and earth meet and make mud', Boolean(made)],
    ['the mud reaches the town store', stored > 0],
    ['no carrier stalled', stalled.length === 0],
    ['the fire itself swallows nothing', fire?.state.held === null],
    ['the hearth is ringed with eight bins', bins.length === 8],
    ['a bin holds eight', bins.every(({ state }) => (state.held?.capacity ?? STORAGE_CAPACITY) === 8)],
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
        ? `first mud on tick ${made?.tick}, ${stored} of it in the bins`
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
  const woodIsForest =
    sweep.some((parcel) => parcel.biome === Biome.Forest) &&
    sweep.every(
      (parcel) => landYield(fresh, parcel.id).includes(ItemType.Wood) === (parcel.biome === Biome.Forest),
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
    ['wood grows only in forest', woodIsForest],
    ['the sea yields nothing', nothingInTheSea],
    [
      'every standing building has one state per block of its design',
      [...run.settlement.buildings.values()].every(
        (building) => building.blocks.length === building.design.blocks.length,
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
  log(header('LEVEL 6 — The library: nothing is raised that was not drawn first'));
  const world = generateWorld(SEED);
  const { settlement, water } = foundBesideWater(world);
  const hearth = settlement.buildings.get(settlement.hearthId);
  if (!hearth) throw new Error('a settlement with no hearth');

  const opening = [...settlement.buildings.values()];
  // Nobody has walked anywhere yet, so nothing is worn: paths are made by walking, not founding.
  const openingWear = world.wear.size;

  // Deliberately out in the open: a parcel touching a building or a stretch of dirt is already
  // linked to the town, which would make "a building alone is linked to nothing" pass for the
  // wrong reason.
  const taken = new Set(opening.map((building) => building.cellId));
  const well = workOf('well');
  const dig = workOf('digging');
  // Dry ground specifically. The town is founded on a bank — that is what founding beside water
  // means now — and a bank yields water, so the nearest free parcel is as likely as not to be
  // somewhere a well works perfectly well.
  const free = freeParcelsNear(world, hearth.position, 140).find(
    (id) =>
      canBuild(world, settlement, id, dig).ok &&
      !landYield(world, id).includes(ItemType.Water) &&
      !taken.has(id) &&
      parcelOf(world.seed, id).neighbors.every((neighbor) => !taken.has(neighbor)),
  );
  if (!free) throw new Error('no free parcel away from the town');

  // A well wants water running through its tile; a dig wants earth, which is everywhere. The
  // refusal is the whole of siting, so it is checked on the same parcel the dig is happy with.
  const wellOnDryGround = canBuild(world, settlement, free, well);
  const raised = placeBuilding(world, settlement, free, dig);
  const raisedWhereItWasPut = settlement.buildings.get(raised.id)?.cellId === free;
  const takenAgain = canBuild(world, settlement, free, dig);
  const hearthRefused = canBuild(world, settlement, water, HEARTH_DESIGN);

  const openingCarriers = CARRIERS_FOR(1);
  const beforeGrowth = settlement.carriers.size;

  // The library: an unfinished design is refused, a finished one is kept, and editing one that
  // is already standing re-tools it rather than letting blueprint and building drift apart.
  const blank = emptyDesign('', 'Nothing');
  const blankRefused = saveDesign(world, blank) === null;

  // The ground is opened by the land works and nothing else: a design with a source drawn into
  // it is refused, and so is one that would take a land work's name in the library.
  const drawnWell = cloneDesign(workOf('well'), 'deep-well', 'Deep Well');
  const drawnSourceRefused = !validateDesign(drawnWell).ok && saveDesign(world, drawnWell) === null;
  const nameRefused = saveDesign(world, cloneDesign(designFrom(world, 'mud-mixer'), 'well')) === null;
  const libraryHasNoLandWorks = [...world.library.keys()].every((id) => !isLandWork(id));

  const draft = cloneDesign(designFrom(world, 'mud-mixer'), 'big-mixer', 'Big Mixer');
  const saved = saveDesign(world, draft);
  const mixerSite = freeParcelsNear(world, hearth.position, 140).find(
    (id) => id !== water && canBuild(world, settlement, id, draft).ok,
  );
  const bigMixer = saved && mixerSite ? placeBuilding(world, settlement, mixerSite, saved) : null;
  const beforeEdit = bigMixer?.design.blocks.length ?? 0;
  if (saved) {
    const wider = cloneDesign(saved);
    wider.blocks = [
      ...wider.blocks,
      { kind: BlockKind.Transport, x: 4, y: 4, facing: Direction.East },
    ];
    saveDesign(world, wider);
  }
  const retooled = retool(world, 'big-mixer');
  const afterEdit = settlement.buildings.get(bigMixer?.id ?? '')?.design.blocks.length ?? 0;

  const wellOnBank = canBuild(world, settlement, water, well);
  const standing = wellOnBank.ok ? placeBuilding(world, settlement, water, well) : undefined;
  // The bank holds dirt as well as water, but a parcel takes one building: what to work is chosen.
  const oneWorkPerParcel = landYield(world, water).includes(ItemType.Dirt) && !canBuild(world, settlement, water, dig).ok;
  // A source holds nothing: the only buffer a well shows is the crate it ships from.
  const sourceKeepsNothing =
    standing !== undefined && visibleBuffers(standing).every((buffer) => buffer.item === ItemType.Water)
      && visibleBuffers(standing).length === 1;

  // Raise sheds until the town is big enough to need another pair of hands.
  for (const id of freeParcelsNear(world, hearth.position, 90)) {
    if (settlement.buildings.size >= 4) break;
    if (canBuild(world, settlement, id, workOf('digging')).ok) {
      placeBuilding(world, settlement, id, workOf('digging'));
    }
  }
  const grownCarriers = settlement.carriers.size;
  const wantedCarriers = CARRIERS_FOR(settlement.buildings.size);

  const razed = raze(world, settlement, raised.id);
  const hearthStays = !raze(world, settlement, hearth.id);
  const hearthHidden = buildableDesigns(world).every((design) => design.id !== HEARTH_DESIGN_ID);
  removeDesign(world, 'big-mixer');

  const checks: [string, boolean][] = [
    ['a new settlement is one hearth and nothing else', opening.length === 1],
    ['founding wears no path: nobody has walked yet', openingWear === 0],
    ['the dig stands on the parcel it was placed on', raisedWhereItWasPut],
    ['a taken parcel is refused', !takenAgain.ok],
    ['the hearth is not the player’s to place', !hearthRefused.ok && hearthHidden],
    ['a source is refused where the ground holds none of it', !wellOnDryGround.ok],
    ['a source keeps no stock of its own', sourceKeepsNothing],
    ['an unfinished design cannot be saved', blankRefused && !validateDesign(blank).ok],
    ['a drawn design cannot open the ground', drawnSourceRefused],
    ['the library cannot take a land work’s name', nameRefused],
    ['the land works are not in the library', libraryHasNoLandWorks],
    ['a well is raised straight onto a bank', wellOnBank.ok && standing !== undefined],
    ['a parcel holding two items takes one land work', oneWorkPerParcel],
    ['a drawn design can be raised', bigMixer !== null && beforeEdit > 0],
    ['editing a design re-tools what stands on it', retooled === 1 && afterEdit === beforeEdit + 1],
    ['a town opens with two carriers', openingCarriers === 2 && beforeGrowth === 2],
    [
      'raising more buildings hires more of them',
      grownCarriers > beforeGrowth && grownCarriers === wantedCarriers,
    ],
    ['razing removes the building', razed && !settlement.buildings.has(raised.id)],
    ['the hearth cannot be razed', hearthStays],
    [
      'a design is drawn on a grid, not chosen from a list',
      designRadius(draft) > 0 && blockAt(draft, 2, 2) >= 0,
    ],
  ];

  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-6',
    title: 'The library',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `opened as a hearth alone, sank a well, drew and raised a ${draft.label}`
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
  const settlement = foundBesideWater(world).settlement;
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
  for (let tick = 1; tick <= 600; tick += 1) processBuilding(idle.digging, tick);
  const unworkedDrewNothing = idle.digging.producedTotal === 0;

  const run = harness();
  let workingOffMap = true;
  let oneWorkerEach = true;
  for (let i = 0; i < 1500; i += 1) {
    const report = run.engine.tick();
    run.events.push(...report.events);

    const inside = new Map<string, number>();
    for (const carrier of run.settlement.carriers.values()) {
      if (carrier.state !== CarrierState.Working) continue;
      const site = run.settlement.buildings.get(carrier.atId);
      // Inside the building, not out on a path: that is what lets the map hide it.
      if (carrier.trail.length > 0 || !site || !isLandWork(site.designId)) workingOffMap = false;
      inside.set(carrier.atId, (inside.get(carrier.atId) ?? 0) + 1);
    }
    if ([...inside.values()].some((count) => count > 1)) oneWorkerEach = false;
  }

  /**
   * The first whole shift at a site: the run of `produced` events one villager made there without
   * anyone else's in between, and what that villager did next.
   */
  const firstShift = (site: Building) => {
    const made = run.events.filter((event) => event.kind === 'produced' && event.buildingId === site.id);
    const worker = made[0]?.carrierId;
    const shift = [];
    for (const event of made) {
      if (event.carrierId !== worker) break;
      shift.push(event);
      if (shift.length > 1 && event.tick - shift[shift.length - 2]!.tick !== paceOf(landWorkById(site.designId)!)) {
        shift.pop();
        break;
      }
    }
    const last = shift[shift.length - 1];
    const next = last
      ? run.events.find((event) => event.carrierId === worker && event.tick > last.tick && event.kind !== 'produced')
      : undefined;
    return { shift, next };
  };

  const checks: [string, boolean][] = [
    ['an unworked dig draws nothing', unworkedDrewNothing],
    ['a well bucket takes five seconds', landWorkById('well')?.batch === 1 && landWorkById('well')?.ticks === 50],
    ['the dig gives five loads in ten seconds', landWorkById('digging')?.batch === 5 && landWorkById('digging')?.ticks === 100],
    ['the woodcutter gives ten logs in fifteen', landWorkById('woodcutter')?.batch === 10 && landWorkById('woodcutter')?.ticks === 150],
    ['a worker is never out on the map while working', workingOffMap],
    ['one villager works a site at a time', oneWorkerEach],
  ];

  for (const site of [run.well, run.digging]) {
    const work = landWorkById(site.designId)!;
    const { shift, next } = firstShift(site);
    log(
      `  ${site.design.label}: ${shift.length} × ${work.item}, a unit every ${paceOf(work)} ticks, ` +
        `then ${next ? `${next.kind} of ${next.item} at ${next.buildingId === site.id ? 'the same site' : next.buildingId}` : 'nothing'}`,
    );
    checks.push([`one shift at the ${site.design.label} yields the batch`, shift.length === work.batch]);
    checks.push([
      `the ${site.design.label}'s worker carries out what it drew`,
      next?.kind === 'pickup' && next.buildingId === site.id && next.item === work.item,
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
  const mixer = designFrom(world, 'mud-mixer');

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
  const dig = run.digging;
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

  play(run, 1500, () => {});
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

  // Stretched out, so there are walks long enough to wear a path along: a dig at the edge of the
  // claim, then another at the edge that one pushed out.
  let far = run.mixer;
  for (let i = 0; i < 2; i += 1) {
    const edge = claimOf(world, settlement)
      .filter((id) => canBuild(world, settlement, id, workOf('digging')).ok)
      .sort((a, b) => distance(parcelOf(world.seed, b).site, hearth.position) - distance(parcelOf(world.seed, a).site, hearth.position))[0];
    if (edge) far = placeBuilding(world, settlement, edge, workOf('digging'));
  }

  const fresh = route(world, hearth.cellId, far.cellId);
  const freshCost = fresh ? routeCost(world, fresh) : Infinity;
  play(run, 3000, () => {});

  const worn = [...world.wear.keys()];
  const showing = worn.filter((id) => wornness(world, id) >= 0.1);
  const again = route(world, hearth.cellId, far.cellId);
  const wornCost = fresh ? routeCost(world, fresh) : Infinity;
  const onPaths = again ? again.filter((id) => (world.wear.get(id) ?? 0) > 0).length / again.length : 0;

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
  log(`  hearth to the furthest dig (${fresh?.length ?? 0} nodes): ${freshCost.toFixed(1)} on fresh ground, ${wornCost.toFixed(1)} once worn; the new route ${(onPaths * 100).toFixed(0)}% on worn ground`);

  const checks: [string, boolean][] = [
    ['walking wears the ground', worn.length > 0],
    ['enough of it is worn to show as paths', showing.length > 10],
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

export function runLevel13(log: Logger): LevelResult {
  log(header('LEVEL 13 — The works: an empty shed, fitted out where it stands, with bays that face out'));
  const run = harness();
  const { world, settlement } = run;
  const hearth = settlement.buildings.get(settlement.hearthId)!;

  // A shed with nothing in it: legal, raised, and doing nothing until somebody fits it out.
  const site = freeParcelsNear(world, hearth.position, 70).find((id) =>
    canBuild(world, settlement, id, WORKS_DESIGN).ok,
  );
  if (!site) throw new Error('nowhere to put a works');
  const works = placeBuilding(world, settlement, site, WORKS_DESIGN);
  const raisedEmpty = works.design.blocks.length === 0;

  // Fitting out while the site is still being prepared is free, however much the player changes
  // their mind: the builders are already there.
  const wasClearing = works.clearing?.needed ?? 0;
  const free = fittingFree(works);
  fitBlock(works, { kind: BlockKind.Input, x: 0, y: 2, facing: Direction.East, item: ItemType.Water });
  fitBlock(works, { kind: BlockKind.Transport, x: 1, y: 2, facing: Direction.East });
  fitBlock(works, { kind: BlockKind.Transport, x: 2, y: 2, facing: Direction.North });
  turnBlock(works, 2, 2);
  clearBlock(works, 2, 2);
  fitBlock(works, { kind: BlockKind.Transport, x: 2, y: 2, facing: Direction.East });
  // The run has to be unbroken: a chute handing on to bare floor is where a load stops, which is
  // true of the game and was true of this level until the gap at (3,2) was noticed.
  fitBlock(works, { kind: BlockKind.Transport, x: 3, y: 2, facing: Direction.East });
  fitBlock(works, { kind: BlockKind.Output, x: 4, y: 2, facing: Direction.East, item: ItemType.Water });
  const stillFree = (works.clearing?.needed ?? 0) === wasClearing && works.clearing?.done === 0;
  const inStep = works.blocks.length === works.design.blocks.length;

  // Open it, then change it: that costs a stop while somebody re-tools the machine.
  const opened = (building: Building): Building => building;
  works.clearing = null;
  works.state = BuildingState.Idle;

  // Moving the furniture about costs nothing: a bin set down, a chute turned.
  fitBlock(works, { kind: BlockKind.Storage, x: 4, y: 0, facing: Direction.East });
  // The bin, not a chute of the run: turning a square of the line would break the run this
  // level goes on to test, which is itself the point of the chevrons being drawn on the bed.
  turnBlock(works, 4, 0);
  const furnitureFree = opened(works).clearing === null && opened(works).retooling === 0;

  // Setting a vessel stops the works — and only the works: the site stays built, so nobody has
  // to walk over and dispatch goes on filling the bays round it.
  fitBlock(works, { kind: BlockKind.Combine, x: 2, y: 0, facing: Direction.East, recipeId: 'mud' });
  const after = opened(works);
  const retooled = after.retooling === FIT_TICKS && after.clearing === null;
  processBuilding(works, 1, false);
  const ticksDown = opened(works).retooling === FIT_TICKS - 1;
  clearBlock(works, 2, 0);
  opened(works).retooling = 0;

  // A bay is served from the corner of the parcel nearest the bearing it leans towards, so a bay
  // on the east of the floor is walked to from the east. Water serves nothing: nobody stands there.
  const parcel = parcelOf(world.seed, works.cellId);
  const west = dockZone(works, ItemType.Water, 'give');
  const east = dockZone(works, ItemType.Water, 'take');
  const westNode = west ? zoneCornerOf(world, works, west) : null;
  const eastNode = east ? zoneCornerOf(world, works, east) : null;
  const sideOf = (node: string | null): number => {
    const vertex = parcel.vertices.find((v) => cornerNode(v) === node);
    return vertex ? vertex.x - parcel.site.x : 0;
  };
  const facesOut = westNode !== null && eastNode !== null && westNode !== eastNode;
  const rightSides = sideOf(westNode) < 0 && sideOf(eastNode) > 0;
  const dryDoors = [westNode, eastNode].every((node) => {
    const vertex = parcel.vertices.find((v) => cornerNode(v) === node);
    return vertex !== undefined && !isWater(biomeAt(world.seed, vertex));
  });
  // A square in the middle of the floor is nobody's door.
  const inside = zoneCornerOf(world, works, {
    kind: BlockKind.Transport,
    x: 2,
    y: 2,
    facing: Direction.East,
  });

  // Laid the way a player lays it — the bay first, pointing at nothing, then the run under it —
  // a line still joins up. Every square used to be laid facing east whatever was round it, so a
  // drop-off at the top of the floor handed east into bare ground and the works did nothing,
  // with no mark on the screen to say why.
  const byHand = createBuilding('hand/1', WORKS_DESIGN, works.cellId, works.position, []);
  fitBlock(byHand, { kind: BlockKind.Input, x: 0, y: 0, facing: Direction.East, item: ItemType.Water });
  fitBlock(byHand, { kind: BlockKind.Transport, x: 0, y: 1, facing: Direction.East });
  fitBlock(byHand, { kind: BlockKind.Transport, x: 0, y: 2, facing: Direction.East });
  fitBlock(byHand, { kind: BlockKind.Transport, x: 1, y: 2, facing: Direction.East });
  fitBlock(byHand, { kind: BlockKind.Output, x: 2, y: 2, facing: Direction.East });
  byHand.clearing = null;
  depositHopper(byHand, ItemType.Water, 2);
  for (let tick = 1; tick <= 40; tick += 1) processBuilding(byHand, tick, false);
  const joinedUp = outputStock(byHand, ItemType.Water) === 2;

  // A well and the fire are not machines anybody drew: they open to be looked at, and nothing
  // may be laid in them.
  const wellShut =
    !canFit(run.well).ok &&
    !fitBlock(run.well, { kind: BlockKind.Storage, x: 0, y: 0, facing: Direction.East });
  const hearthShut = !canFit(hearth).ok && !clearBlock(hearth, 1, 1);
  const wellWhole = run.well.design.blocks.length === workOf('well').blocks.length;

  // The run carries: water left on the drop-off goes down the chute and ends up in the pick-up
  // bay at the far end of the floor. Put in by hand and ticked by hand, because what is being
  // asserted is the chute — whether the *town* chooses to feed this works ahead of its mixer is
  // dispatch's business, and a level that waits on that is testing two things and naming one.
  // Cleared by hand first: the re-tool above left a villager's worth of work on it, and a
  // building that is being worked on does nothing at all — which is the rule being tested two
  // checks up, so it has to be undone here rather than waited out.
  works.clearing = null;
  works.state = BuildingState.Idle;
  const batch = depositHopper(works, ItemType.Water, 2);
  for (let tick = 1; tick <= 30; tick += 1) processBuilding(works, tick, false);
  const ranTheChute = batch === 2 && outputStock(works, ItemType.Water) === 2;

  play(run, 900, () => {});
  const delivered = run.events.some((e) => e.kind === 'dropoff' && e.buildingId === works.id);

  log(`  the works went up empty and was fitted with ${works.design.blocks.length} squares while its site was dug`);
  log(`  the drop-off is served at ${westNode}, the pick-up at ${eastNode}`);

  const checks: [string, boolean][] = [
    ['an empty works may be raised', raisedEmpty],
    ['fitting out a site being prepared is free', free && stillFree],
    ['the squares and their state stay in step', inStep],
    ['moving the furniture about is free', furnitureFree],
    ['setting a vessel stops the works, without unbuilding it', retooled && ticksDown],
    ['two bays on opposite sides are served from different corners', facesOut],
    ['each is served from its own side of the parcel', rightSides],
    ['no bay is served across water', dryDoors],
    ['a square in the dead centre of the floor leans no way', inside === null],
    ['nothing may be laid in a land work', wellShut && wellWhole],
    ['nothing may be laid in the hearth', hearthShut],
    ['a load runs the chute to the bay at the far end', ranTheChute],
    ['a run laid without minding the facings still joins up', joinedUp],
    ['a fitted works is hauled to', delivered],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-13',
    title: 'The works',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `raised empty, fitted with ${works.design.blocks.length} squares, bays on ${westNode === eastNode ? 'one' : 'two'} sides`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

export function runAllLevels(log: Logger): LevelResult[] {
  const levels = [runLevel1, runLevel2, runLevel3, runLevel4, runLevel5, runLevel6, runLevel7, runLevel8, runLevel9, runLevel10, runLevel11, runLevel12, runLevel13];
  const results = levels.map((level) => level(log));
  log('');
  for (const result of results) log(verdict(result.title, result.passed, result.detail));
  return results;
}
