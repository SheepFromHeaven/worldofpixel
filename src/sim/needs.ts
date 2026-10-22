import { storedStock } from './buildings.ts';
import { claimOf } from './claims.ts';
import { cellNode } from './footpaths.ts';
import { distance } from './geometry.ts';
import type { Vec2 } from './geometry.ts';
import { bedsIn as areaBeds, groundWork, shelteredArea, stillWanted } from './area.ts';
import { landYield } from './markers.ts';
import { parcelOf } from './terrain/parcels.ts';
import { hashString } from './rng.ts';
import { held } from './stock.ts';
import { ItemType } from './types.ts';
import type {
  Activity,
  Building,
  Carrier,
  CellId,
  Diary,
  ItemType as Item,
  Job,
  NeedKind,
  Needs,
  Settlement,
} from './types.ts';
import type { GameWorld } from './world.ts';

export const DAY_HOURS = 14;
export const DAY_TICKS = 600;

export const LOW = 0.3;

export const DRAIN: Needs = { thirst: (1 - LOW) / 110, hunger: (1 - LOW) / 200, rest: (1 - LOW) / 420 };
const ASLEEP = 0.5;

export const DRINK_TICKS = { stored: 12, open: 20 };
export const BERRY_TICKS = 10;
export const BERRY_FILL = 0.35;
export const FORAGE_TICKS = 40;
export const SLEEP_GAIN = { roofed: 1 / 60, open: 1 / 110 };

export function freshNeeds(id: string): Needs {
  const spread = (salt: string) => 0.55 + 0.45 * ((hashString(`${id}:${salt}`) % 1000) / 1000);
  return { thirst: spread('thirst'), hunger: spread('hunger'), rest: spread('rest') };
}

export function drainNeeds(carrier: Carrier): void {
  const asleep = carrier.job?.kind === 'sleep' && carrier.state === 'SEEING_TO_NEED';
  const pace = asleep ? ASLEEP : 1;
  carrier.needs.thirst = Math.max(0, carrier.needs.thirst - DRAIN.thirst * pace);
  carrier.needs.hunger = Math.max(0, carrier.needs.hunger - DRAIN.hunger * pace);
  if (!asleep) carrier.needs.rest = Math.max(0, carrier.needs.rest - DRAIN.rest);
}

const METER: Record<NeedKind, keyof Needs> = { drink: 'thirst', eat: 'hunger', sleep: 'rest' };
const KINDS: readonly NeedKind[] = ['drink', 'eat', 'sleep'];

export function neediest(carrier: Carrier): NeedKind | null {
  let worst: NeedKind | null = null;
  for (const kind of KINDS) {
    if (kind === 'sleep' && worst !== null) break;
    const level = carrier.needs[METER[kind]];
    if (level > LOW) continue;
    if (worst === null || level < carrier.needs[METER[worst]]) worst = kind;
  }
  return worst;
}

export function needJob(world: GameWorld, settlement: Settlement, carrier: Carrier): Job | null {
  const kind = neediest(carrier);
  if (!kind) return null;
  const hearth = settlement.buildings.get(settlement.hearthId);
  if (!hearth) return null;
  const at = carrier.position;
  const errand = (item: Item, building: Building, spot?: string): Job => ({
    kind,
    item,
    sourceId: building.id,
    destinationId: building.id,
    ...(spot ? { spot } : {}),
  });

  if (kind === 'drink') {
    const stored = nearest(settlement, at, (b) => held(b, ItemType.Water) > 0);
    if (stored) return errand(ItemType.Water, stored);
    const well = nearest(settlement, at, drawsWater);
    if (well) return errand(ItemType.Water, well);
    const bank = nearestSpot(world, settlement, at, 'banks');
    return errand(ItemType.Water, hearth, bank ?? undefined);
  }

  if (kind === 'eat') {
    const stored = nearest(settlement, at, (b) => held(b, ItemType.Berries) > 0);
    if (stored) return errand(ItemType.Berries, stored);
    const growing = nearestSpot(world, settlement, at, 'growing');
    return errand(ItemType.Berries, hearth, growing ?? undefined);
  }

  const bed = nearest(
    settlement,
    at,
    (b) => shelteredArea(b) && bedsOf(b) > 0 && sleepersIn(settlement, b.id) < bedsOf(b),
  );
  return errand(ItemType.Dirt, bed ?? hearth);
}

function nearest(settlement: Settlement, at: Vec2, ok: (building: Building) => boolean): Building | null {
  let best: Building | null = null;
  for (const building of settlement.buildings.values()) {
    if (building.clearing || !ok(building)) continue;
    if (!best || distance(at, building.position) < distance(at, best.position)) best = building;
  }
  return best;
}

function sleepersIn(settlement: Settlement, buildingId: string): number {
  let count = 0;
  for (const carrier of settlement.carriers.values()) {
    if (carrier.job?.kind === 'sleep' && carrier.job.sourceId === buildingId) count += 1;
  }
  return count;
}

export function asleepIndoors(settlement: Settlement, carrier: Carrier): boolean {
  if (carrier.job?.kind !== 'sleep' || carrier.state !== 'SEEING_TO_NEED') return false;
  const area = settlement.buildings.get(carrier.job.sourceId);
  return area !== undefined && shelteredArea(area);
}

interface Spots {
  revision: number;
  banks: { cell: CellId; site: Vec2 }[];
  growing: { cell: CellId; site: Vec2 }[];
}

const spots = new Map<string, Spots>();

function spotsOf(world: GameWorld, settlement: Settlement): Spots {
  const key = `${world.seed}:${settlement.id}`;
  const cached = spots.get(key);
  if (cached && cached.revision === settlement.revision) return cached;
  const built = new Set([...settlement.buildings.values()].map((b) => b.cellId));
  const fresh: Spots = { revision: settlement.revision, banks: [], growing: [] };
  for (const cell of claimOf(world, settlement)) {
    if (built.has(cell)) continue;
    const yields = landYield(world, cell);
    const site = parcelOf(world.seed, cell).site;
    if (yields.includes(ItemType.Water)) fresh.banks.push({ cell, site });
    if (yields.includes(ItemType.Deadwood)) fresh.growing.push({ cell, site });
  }
  spots.set(key, fresh);
  return fresh;
}

function nearestSpot(world: GameWorld, settlement: Settlement, at: Vec2, kind: 'banks' | 'growing'): string | null {
  let best: { cell: CellId; site: Vec2 } | null = null;
  for (const spot of spotsOf(world, settlement)[kind]) {
    if (!best || distance(at, spot.site) < distance(at, best.site)) best = spot;
  }
  return best ? cellNode(best.cell) : null;
}

export function drawsWater(building: Building): boolean {
  return (
    building.yields.includes(ItemType.Water) &&
    groundWork(building)?.item === ItemType.Water
  );
}

export function activityOf(carrier: Carrier): Activity {
  switch (carrier.job?.kind) {
    case 'drink':
      return 'water';
    case 'eat':
      return 'food';
    case 'sleep':
      return 'rest';
    case undefined:
      return 'idle';
    default:
      return 'work';
  }
}

const emptyDay = (): Record<Activity, number> => ({ rest: 0, water: 0, food: 0, work: 0, idle: 0 });

export function recordDay(settlement: Settlement, tick: number): Diary {
  const diary = (settlement.diary ??= { since: tick, today: emptyDay(), last: null });
  if (tick - diary.since >= DAY_TICKS) {
    diary.last = diary.today;
    diary.today = emptyDay();
    diary.since = tick;
  }
  for (const carrier of settlement.carriers.values()) diary.today[activityOf(carrier)] += 1;
  return diary;
}

export function dayOf(settlement: Settlement): Record<Activity, number> {
  const diary = settlement.diary;
  const day = emptyDay();
  if (!diary) return day;
  const counts = diary.last ?? diary.today;
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (total === 0) return day;
  for (const part of Object.keys(day) as Activity[]) day[part] = (counts[part] / total) * DAY_HOURS;
  return day;
}

export function vesselsHeld(settlement: Settlement): number {
  return countHeld(settlement, ItemType.Vessel) + countHeld(settlement, ItemType.Pot);
}

function countHeld(settlement: Settlement, item: Item): number {
  let held = 0;
  for (const building of settlement.buildings.values()) held += storedStock(building, item);
  return held;
}

export function canHaul(settlement: Settlement, item: Item): boolean {
  if (!wanted(settlement, item)) return false;
  return item !== ItemType.Water || vesselsHeld(settlement) > 0;
}

export function wanted(settlement: Settlement, item: Item): boolean {
  if (item === ItemType.Berries || item === ItemType.Water) return true;
  for (const building of settlement.buildings.values()) {
    if (stillWanted(building).some((cost) => cost.item === item)) return true;
  }
  for (const method of settlement.book.methods.values()) {
    if (method.inputs.some((input) => input.item === item)) return true;
  }
  return false;
}

export function bedsIn(settlement: Settlement): number {
  let beds = 0;
  for (const building of settlement.buildings.values()) beds += bedsOf(building);
  return beds;
}

export function bedsOf(building: Building): number {
  return areaBeds(building);
}

