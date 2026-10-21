import { storedStock } from './buildings.ts';
import { claimOf } from './claims.ts';
import { cellNode } from './footpaths.ts';
import { distance } from './geometry.ts';
import type { Vec2 } from './geometry.ts';
import { landWorkById } from './landWorks.ts';
import { landYield } from './markers.ts';
import { parcelOf } from './parcels.ts';
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

/**
 * The bottom of the pyramid, villager by villager.
 *
 * Each villager carries three meters, thirst, hunger and rest, that run down on their own. When
 * one falls to `LOW` the villager stops taking work and goes to see to it: a drink, something to
 * eat, a sleep. Nothing here is a budget worked out for the town; the day is whatever the
 * villagers actually did, and the town's slab reads it back off them (`recordDay`).
 *
 * **Needs cost time, never lives.** A meter at nothing slows nobody down and kills nobody: it
 * only means the villager goes and sees to it before anything else. A survival death-loop
 * punishes the player for the one thing they have least information about.
 *
 * What the chapter buys back is how long seeing to a need takes. Water in a store is a drink at
 * the fire instead of a walk to the bank; berries in a store are a meal instead of an afternoon
 * picking; a roof is a night's sleep in half the time.
 */

export const DAY_HOURS = 14;
/** An hour of the villagers' day. A tick is a tenth of a second, so a day runs about a minute and a half. */
export const TICKS_PER_HOUR = 60;
export const DAY_TICKS = DAY_HOURS * TICKS_PER_HOUR;

/** Below this a villager takes no more work until the need is seen to. */
export const LOW = 0.3;

/** How much of a meter goes in a tick awake. Thirst comes round about four times a day. */
export const DRAIN: Needs = { thirst: 1 / 320, hunger: 1 / 520, rest: 1 / 840 };
/** Asleep, thirst and hunger come on at half the pace. */
const ASLEEP = 0.5;

/** A drink from water standing in a store, or at the water itself. */
export const DRINK_TICKS = { stored: 12, open: 20 };
/** One handful of berries, and how far it fills you. */
export const BERRY_TICKS = 10;
export const BERRY_FILL = 0.35;
/** Picking your own as you go: slow, but there is always something. */
export const FORAGE_TICKS = 140;
/** A night's rest gained per tick, under a roof and in the open. */
export const SLEEP_GAIN = { roofed: 1 / 120, open: 1 / 220 };

/**
 * Where everybody starts, spread out by who they are so the band does not all get thirsty in
 * the same tick: a map where everybody stops at once reads as the game having frozen.
 */
export function freshNeeds(id: string): Needs {
  const spread = (salt: string) => 0.55 + 0.45 * ((hashString(`${id}:${salt}`) % 1000) / 1000);
  return { thirst: spread('thirst'), hunger: spread('hunger'), rest: spread('rest') };
}

/** A tick of a villager's needs running down. */
export function drainNeeds(carrier: Carrier): void {
  const asleep = carrier.job?.kind === 'sleep' && carrier.state === 'SEEING_TO_NEED';
  const pace = asleep ? ASLEEP : 1;
  carrier.needs.thirst = Math.max(0, carrier.needs.thirst - DRAIN.thirst * pace);
  carrier.needs.hunger = Math.max(0, carrier.needs.hunger - DRAIN.hunger * pace);
  if (!asleep) carrier.needs.rest = Math.max(0, carrier.needs.rest - DRAIN.rest);
}

const METER: Record<NeedKind, keyof Needs> = { drink: 'thirst', eat: 'hunger', sleep: 'rest' };
const KINDS: readonly NeedKind[] = ['drink', 'eat', 'sleep'];

/**
 * The need that has to be seen to first, or null if none is down to `LOW`. A drink or a meal
 * before sleep, whichever is lower: lie down hungry and hunger wakes you within the hour.
 */
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

/**
 * Where a villager goes to see to a need, as an errand.
 *
 * Nearest first, by straight line like every other errand: water standing in a building, then a
 * well, then the bank; berries in a building, then picking them off the ground; a free bed under
 * a roof, then the fire.
 */
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
    (b) => b.design.sheltered === true && sleepersIn(settlement, b.id) < bedsOf(b),
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

/** Whether a villager is asleep under a roof, which is off the map like somebody on a shift. */
export function asleepIndoors(settlement: Settlement, carrier: Carrier): boolean {
  if (carrier.job?.kind !== 'sleep' || carrier.state !== 'SEEING_TO_NEED') return false;
  return settlement.buildings.get(carrier.job.sourceId)?.design.sheltered === true;
}

interface Spots {
  revision: number;
  banks: { cell: CellId; site: Vec2 }[];
  growing: { cell: CellId; site: Vec2 }[];
}

const spots = new Map<string, Spots>();

/**
 * Open ground in the town's claim where a need can be met with nothing built: a bank to drink
 * at, and ground with something growing on it to pick from. Unbuilt only, since a built
 * parcel's middle is inside its building. Kept until the town changes shape.
 */
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

/**
 * A building that has the ground open for water, rather than one that happens to stand on it.
 *
 * A land work is the only thing that opens the ground, so what it draws is its own entry in
 * `LAND_WORKS` — a lean-to on a bank is a bed by a river, not a well.
 */
export function drawsWater(building: Building): boolean {
  return (
    building.yields.includes(ItemType.Water) &&
    landWorkById(building.designId)?.item === ItemType.Water
  );
}

/** What a villager's tick counts as, for the town's day. */
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

/**
 * Where the town's ticks went, a villager-tick at a time, kept for the day under way and the
 * last whole one. This is the whole of what the town's slab says about a day: what was watched.
 */
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

/**
 * One villager's day, in hours of each activity: the last whole day once there has been one,
 * and until then the part of today seen so far, scaled up to a day.
 */
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

/** What a daubed basket carries, and what a fired pot does. */
export const VESSEL_LITRES = 3;
export const POT_LITRES = 8;

/** Everything the town has to carry water in, wherever it is standing. */
export function vesselsHeld(settlement: Settlement): number {
  return countHeld(settlement, ItemType.Vessel) + countHeld(settlement, ItemType.Pot);
}

/** The biggest thing the town has to carry water in, which is what sets a trip's worth. */
export function litresPerVessel(settlement: Settlement): number {
  return countHeld(settlement, ItemType.Pot) > 0 ? POT_LITRES : VESSEL_LITRES;
}

/** Everything of a kind the town has, wherever it is standing. */
function countHeld(settlement: Settlement, item: Item): number {
  let held = 0;
  for (const building of settlement.buildings.values()) held += storedStock(building, item);
  return held;
}

/**
 * Whether the town may carry an item at all.
 *
 * Water is the one that needs an answer: until there is something to carry it in, everybody
 * drinks at the source and nobody fetches for anybody. That is what makes the first vessel a
 * milestone rather than a convenience, and it is why the bank dig exists — mud without carrying
 * water, which is the only way out of the circle.
 */
export function canHaul(settlement: Settlement, item: Item): boolean {
  if (!wanted(settlement, item)) return false;
  return item !== ItemType.Water || vesselsHeld(settlement) > 0;
}

/**
 * Whether anything in the town would ever use this.
 *
 * A store takes anything and is the destination of last resort, which together mean a thing
 * nobody wants is carried to the fire and left there for good. With Water that is not merely
 * untidy: the well is step 11 and the hearth's shelf is the town's, so the biggest hour-saving
 * in the chapter could fill the very shelf the sealing method draws its baskets off, and stop it.
 *
 * So an item is cargo when some method in the book asks for it, or a villager would eat or drink
 * it, and not before. Each item has its own room on a shelf now, so water carried to the fire
 * for drinking no longer crowds out anything else standing there.
 */
export function wanted(settlement: Settlement, item: Item): boolean {
  if (item === ItemType.Berries || item === ItemType.Water) return true;
  for (const method of settlement.book.methods.values()) {
    if (method.inputs.some((input) => input.item === item)) return true;
  }
  return false;
}

/** Everywhere there is to sleep. A town can be no bigger than the beds it has built. */
export function bedsIn(settlement: Settlement): number {
  let beds = 0;
  for (const building of settlement.buildings.values()) beds += bedsOf(building);
  return beds;
}

export function bedsOf(building: Building): number {
  return building.design.beds ?? 0;
}

