import { parcelOf } from './parcels.ts';
import { treesOn } from './trees.ts';
import { Biome } from './types.ts';
import type { CellId } from './types.ts';
import type { GameWorld } from './world.ts';

/**
 * Preparing a building's site, in ticks of one villager's work, and in two parts: fell every tree
 * on the plot and the ring round it, then dig and level the plot. A site with no trees — sand,
 * open meadow — is digging alone; a site in a forest is mostly felling.
 *
 * The trees are the simulation's own (`trees.ts`), so the felling is the trees that are there, one
 * by one, and the map fells exactly the trees it drew.
 */

/** Ticks to fell one tree. */
export const TICKS_PER_TREE = 30;

/**
 * Ticks to dig and level a plot, by what it is: sand shifts easily; turf, roots, mud and rock less
 * so. Never nothing — every building is set on ground that has been prepared for it.
 */
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

/** The parcels whose trees come down for a building: its plot and the ring round it. */
export function siteParcels(world: GameWorld, cellId: CellId): CellId[] {
  return [cellId, ...parcelOf(world.seed, cellId).neighbors];
}

export function treesOnSite(world: GameWorld, cellId: CellId): number {
  return siteParcels(world, cellId).reduce((sum, id) => sum + treesOn(world, id).length, 0);
}

/** The work a site needs: the felling first, then the digging. */
export function clearingFor(world: GameWorld, cellId: CellId): { needed: number; felling: number } {
  const felling = treesOnSite(world, cellId) * TICKS_PER_TREE;
  return { felling, needed: felling + DIGGING_BY_BIOME[parcelOf(world.seed, cellId).biome] };
}
