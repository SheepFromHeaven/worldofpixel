import { shelteredArea } from '../sim/area.ts';
import { storedStock } from '../sim/buildings.ts';
import { HEARTH_REACH } from '../sim/claims.ts';
import { canBuild, placeBuilding } from '../sim/construction.ts';
import { CORD_WALK, DAUB_PIT, LEAN_TO_ID, WEAVING_FRAME } from '../sim/designs.ts';
import { LogisticsEngine } from '../sim/engine.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { distance } from '../sim/geometry.ts';
import { landWorkById } from '../sim/landWorks.ts';
import { landYield } from '../sim/markers.ts';
import { LOW, neediest } from '../sim/needs.ts';
import { PARCEL, cellsIn, parcelOf } from '../sim/terrain/parcels.ts';
import { nearestWater } from '../sim/terrain/terrain.ts';
import type { Building, CellId, Design, Settlement, TickEvent } from '../sim/types.ts';
import { Biome, ItemType } from '../sim/types.ts';
import type { GameWorld } from '../sim/world.ts';
import { isWater } from '../sim/terrain/worldfield.ts';
import { buildingOn, foundSettlement, generateWorld } from '../sim/worldgen.ts';

import { renderTick } from './render.ts';

export interface LevelResult {
  id: string;
  title: string;
  passed: boolean;
  detail: string;
}

export type Logger = (line: string) => void;

export const SEED = 20261017;
export const TRACE_EVERY = 60;
export const MIDDLE: Vec2 = { x: 558, y: 421 };
export const REACH = 40;

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

export function foundBesideWater(world: GameWorld): {
  settlement: Settlement;
  water: CellId;
  reeds: CellId;
} {
  const water = nearestWater(world.seed, MIDDLE) ?? MIDDLE;
  const near = freeParcelsNear(world, water, REACH);
  const banks = near.filter((id) => landYield(world, id).includes(ItemType.Water));
  const beds = near.filter((id) => parcelOf(world.seed, id).biome === Biome.Marsh);
  const reach = HEARTH_REACH * PARCEL;

  for (const site of near) {
    const middle = parcelOf(world.seed, site).site;
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

export function raiseTheTown(world: GameWorld, settlement: Settlement, water: CellId, reeds: CellId) {
  const hearth = settlement.buildings.get(settlement.hearthId);
  if (!hearth) throw new Error('a settlement with no hearth');

  const plots = freeParcelsNear(world, hearth.position, 70);
  const taken = new Set<CellId>([water, reeds, hearth.cellId]);
  const raise = (design: Design): Building => {
    const site = plots.find((id) => !taken.has(id) && canBuild(world, settlement, id, design).ok);
    if (!site) throw new Error(`nowhere in the claim for a ${design.label}`);
    taken.add(site);
    return placeBuilding(world, settlement, site, design);
  };
  const at = (cellId: CellId, design: Design): Building =>
    placeBuilding(world, settlement, cellId, design);

  const woodcutter = hearth;
  const bank = raise(workOf('bank-dig'));

  const reedBed = at(reeds, workOf('reed-bed'));
  const cordWalk = raise(CORD_WALK);
  const weavingFrame = raise(WEAVING_FRAME);
  const daubPit = raise(DAUB_PIT);

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

export function turnCamps(settlement: Settlement, tick: number): void {
  const recipe = Math.floor(tick / 100) % 2;
  for (const area of settlement.buildings.values()) {
    for (const slot of area.slots) {
      if (slot.design?.id !== 'forage-camp') continue;
      if (recipe === 0) delete slot.recipe;
      else slot.recipe = recipe;
    }
  }
}

export function play(harness: Harness, ticks: number, log: Logger, trace = TRACE_EVERY): void {
  for (let i = 0; i < ticks; i += 1) {
    turnCamps(harness.settlement, harness.engine.tickCount);
    const report = harness.engine.tick();
    harness.events.push(...report.events);
    if (trace > 0 && report.tick % trace === 0) log(renderTick(harness.settlement, report));
  }
}

export function firstEvent(events: TickEvent[], match: Partial<TickEvent>): TickEvent | undefined {
  return events.find((event) =>
    (Object.keys(match) as (keyof TickEvent)[]).every((key) => event[key] === match[key]),
  );
}

export interface Errand {
  carrierId: string;
  kind: string;
  ticks: number;
  easy: boolean;
}

export interface Watched {
  errands: Errand[];
  longestLow: number;
  workedWhileLow: number;
}

export function watchNeeds(run: { engine: LogisticsEngine; settlement: Settlement; events: TickEvent[] }, ticks: number): Watched {
  const open = new Map<string, { kind: string; from: number; easy: boolean }>();
  const low = new Map<string, number>();
  const watched: Watched = { errands: [], longestLow: 0, workedWhileLow: 0 };
  const needKinds = new Set(['drink', 'eat', 'sleep']);

  for (let i = 0; i < ticks; i += 1) {
    turnCamps(run.settlement, i);
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

export const meanTicks = (errands: Errand[]): number =>
  errands.length === 0 ? 0 : Math.round(errands.reduce((sum, e) => sum + e.ticks, 0) / errands.length);
