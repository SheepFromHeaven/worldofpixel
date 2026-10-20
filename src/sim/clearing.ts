import { parcelOf } from './parcels.ts';
import { Biome } from './types.ts';
import type { CellId } from './types.ts';
import type { GameWorld } from './world.ts';

/**
 * How much felling a building's site takes before it can be used, in ticks of one villager's
 * work: its own parcel and the ring round it, each costed by what grows there. A forest is most of
 * half a minute; a meadow is a few seconds of clearing scrub; sand and snow, next to nothing.
 *
 * The simulation does not know where the trees are — they are the map's (`render/groundSprites.ts`)
 * — so it costs the ground by its biome, and the map fells as many of the trees it drew as the
 * work done says. The ring is the same one the map keeps standing trees off once a building is
 * up, so what is cleared is exactly what comes down.
 */
export const CLEARING_PER_PARCEL: Record<Biome, number> = {
  [Biome.Forest]: 40,
  [Biome.Marsh]: 15,
  [Biome.Highland]: 8,
  [Biome.Meadow]: 6,
  [Biome.Tundra]: 4,
  [Biome.Desert]: 2,
  [Biome.Ocean]: 0,
  [Biome.Lake]: 0,
  [Biome.River]: 0,
};

export function clearingNeeded(world: GameWorld, cellId: CellId): number {
  const parcel = parcelOf(world.seed, cellId);
  let needed = CLEARING_PER_PARCEL[parcel.biome];
  for (const id of parcel.neighbors) needed += CLEARING_PER_PARCEL[parcelOf(world.seed, id).biome];
  return needed;
}
