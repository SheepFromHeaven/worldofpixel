import { startingBook } from './book.ts';
import { staffSettlement } from './carriers.ts';
import { growTo, placeIn } from './area.ts';
import { addArea } from './construction.ts';
import { HEARTH_DESIGN, startingLibrary } from './designs.ts';
import { landWorkById } from './landWorks.ts';
import { boundsOf, distance } from './geometry.ts';
import type { Bounds, Vec2 } from './geometry.ts';
import { PARCEL, cellsIn, parcelOf } from './parcels.ts';
import { nameFrom } from './markers.ts';
import { crowdedBy, townIdFor } from './claims.ts';
import { hashString } from './rng.ts';
import type { CellId, Settlement } from './types.ts';
import { fieldFor, isWater, waterCheck } from './worldfield.ts';
import type { GameWorld } from './world.ts';

export interface FoundingCheck {
  ok: boolean;
  /** Shown to the player on hover, so it has to read as a sentence either way. */
  reason: string;
}

export function buildingOn(world: GameWorld, parcelId: CellId): boolean {
  for (const settlement of world.settlements.values()) {
    for (const building of settlement.buildings.values()) {
      if (building.cellId === parcelId) return true;
    }
  }
  return false;
}

/**
 * Anywhere on land that nobody has already built on. There is no resource rule and no territory
 * to be inside of: what the ground holds decides what a town can make for itself, not whether
 * anyone may live there.
 */
export function canFound(world: GameWorld, parcelId: CellId): FoundingCheck {
  const parcel = parcelOf(world.seed, parcelId);
  const standing = waterCheck(parcel.biome);
  if (standing) return { ok: false, reason: standing };
  if (buildingOn(world, parcelId)) return { ok: false, reason: 'something stands here' };
  // A hearth claims the ground round it (`claims.ts`), and a new town is founded with room round
  // it: where its reach would take in ground another town already holds, it may not be set.
  const crowded = crowdedBy(world, parcelId);
  if (crowded) return { ok: false, reason: `too near ${crowded.name} — its claim would be cut into` };
  return { ok: true, reason: 'found a settlement here' };
}

export function foundSettlement(world: GameWorld, parcelId: CellId): Settlement {
  const check = canFound(world, parcelId);
  if (!check.ok) throw new Error(`cannot found a settlement at ${parcelId}: ${check.reason}`);

  const hearthParcel = parcelOf(world.seed, parcelId);
  const seed = hashString(`town:${parcelId}:${world.seed}`);

  const settlement: Settlement = {
    id: townIdFor(parcelId),
    name: nameFrom(seed),
    hearthId: '',
    buildings: new Map(),
    carriers: new Map(),
    book: startingBook(),
    revision: 0,
  };

  // A new settlement is one work area with a fireplace in one slot and a forage camp in the
  // other, walled round with the stones the band turned up on the way. Everything else is put
  // in a slot by hand, and the paths between are worn in by walking them.
  const home = addArea(world, settlement, hearthParcel);
  growTo(home, 1);
  placeIn(home, 0, HEARTH_DESIGN);
  const camp = landWorkById('forage-camp');
  if (camp) placeIn(home, 1, camp.design);
  settlement.hearthId = home.id;

  staffSettlement(settlement);

  world.settlements.set(settlement.id, settlement);
  if (!world.homeSettlementId) world.homeSettlementId = settlement.id;
  return settlement;
}

/**
 * A fresh world is unsettled ground and nothing else — not even a map of it. The seed is the
 * whole map: there is no default, so nobody can ship one map by forgetting to choose.
 *
 * Generating it is where the world is built, rather than wherever the first question about the
 * ground happens to be asked. It is a tenth of a second either way; the difference is whether
 * that tenth of a second is spent here or inside the first frame the renderer draws.
 */
export function generateWorld(seed: number): GameWorld {
  fieldFor(seed);

  return {
    seed,
    settlements: new Map(),
    homeSettlementId: null,
    library: startingLibrary(),
    wear: new Map(),
  };
}

/** A patch of land worth starting on: used by the levels and by the opening camera. */
export function findSettleableParcel(world: GameWorld, near: Vec2, reach = 260): CellId | null {
  const bounds: Bounds = {
    minX: near.x - reach,
    minY: near.y - reach,
    maxX: near.x + reach,
    maxY: near.y + reach,
  };

  const candidates = cellsIn(world.seed, PARCEL, bounds)
    .filter((parcel) => !isWater(parcel.biome))
    .sort((a, b) => distance(a.site, near) - distance(b.site, near) || (a.id < b.id ? -1 : 1));

  return candidates[0]?.id ?? null;
}

export const worldBounds = (points: readonly Vec2[]): Bounds => boundsOf(points);
