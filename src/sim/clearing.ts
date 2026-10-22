import { parcelOf } from './parcels.ts';
import { treesOn } from './trees.ts';
import { Biome } from './types.ts';
import type { CellId } from './types.ts';
import type { GameWorld } from './world.ts';

export const TICKS_PER_TREE = 30;

export const DIGGING_BY_BIOME: Record<Biome, number> = {
  [Biome.Desert]: 40,
  [Biome.Meadow]: 50,
  [Biome.Tundra]: 60,
  [Biome.Forest]: 70,
  [Biome.Marsh]: 80,
  [Biome.Highland]: 90,
  [Biome.Ocean]: 0,
  [Biome.Lake]: 0,
  [Biome.River]: 0,
};

export function siteParcels(world: GameWorld, cellId: CellId): CellId[] {
  return [cellId, ...parcelOf(world.seed, cellId).neighbors];
}

export function treesOnSite(world: GameWorld, cellId: CellId): number {
  return siteParcels(world, cellId).reduce((sum, id) => sum + treesOn(world, id).length, 0);
}

export function clearingFor(world: GameWorld, cellId: CellId): { needed: number; felling: number } {
  const felling = treesOnSite(world, cellId) * TICKS_PER_TREE;
  return { felling, needed: felling + DIGGING_BY_BIOME[parcelOf(world.seed, cellId).biome] };
}
