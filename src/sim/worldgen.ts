import { staffSettlement } from './carriers.ts';
import { addBuilding } from './construction.ts';
import { HEARTH_DESIGN, startingLibrary } from './designs.ts';
import { boundsOf, distance } from './geometry.ts';
import type { Bounds, Vec2 } from './geometry.ts';
import { PARCEL, cellsIn, parcelOf } from './parcels.ts';
import { nameFrom } from './markers.ts';
import { rebuildPaths } from './roads.ts';
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
  return { ok: true, reason: 'set the hearth here' };
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
    paths: new Map(),
    carriers: new Map(),
    roads: new Set(),
    revision: 0,
  };

  // A new settlement is a hearth and not one inch of dirt. Everything else is drawn in the
  // library and raised by hand, including whatever draws on the water around it.
  const hearth = addBuilding(world, settlement, hearthParcel, HEARTH_DESIGN);
  settlement.hearthId = hearth.id;

  rebuildPaths(world, settlement);

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
