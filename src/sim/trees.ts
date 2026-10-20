import type { Vec2 } from './geometry.ts';
import { PARCEL, parcelIndex, siteOf } from './parcels.ts';
import { biomeAt, groundBiomeAt } from './terrain.ts';
import { Biome } from './types.ts';
import type { CellId } from './types.ts';
import type { GameWorld } from './world.ts';
import { isWater } from './worldfield.ts';

/**
 * Where the trees stand. A fact of the world rather than decoration now that they matter — a
 * building's site has to be felled before it can go up, and how long that takes is how many trees
 * there are — so the simulation decides how many grow on a parcel and where, and the map draws a
 * tree at each (`render/groundSprites.ts`, which only chooses *which* tree, by `pick`).
 *
 * A pure function of the seed and the parcel's place on the lattice: the same trees on every call,
 * every load and every machine, and nothing stored.
 */

/**
 * Trees to a parcel, on average, by what the ground is. Together these are the densities the tree
 * decals are drawn at; a decal's own density now only says how often it is *the* tree chosen.
 */
export const TREES_PER_PARCEL: Record<Biome, number> = {
  [Biome.Forest]: 1.42,
  [Biome.Highland]: 0.28,
  [Biome.Tundra]: 0.2,
  [Biome.Marsh]: 0.07,
  [Biome.Meadow]: 0.06,
  [Biome.Desert]: 0.03,
  [Biome.Ocean]: 0,
  [Biome.Lake]: 0,
  [Biome.River]: 0,
};

export interface Tree extends Vec2 {
  /** A number in [0, 1) of the tree's own, for the map to choose which tree to draw. */
  pick: number;
}

function hash(x: number, y: number, salt: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

const known = new Map<string, Tree[]>();

export function treesOn(world: GameWorld, cellId: CellId): Tree[] {
  const key = `${world.seed}:${cellId}`;
  const cached = known.get(key);
  if (cached) return cached;

  const { column, row } = parcelIndex(cellId);
  const site = siteOf(world.seed, PARCEL, column, row);
  const count = Math.floor(TREES_PER_PARCEL[groundBiomeAt(world.seed, site)] + hash(column, row, 7001));
  const trees: Tree[] = [];
  for (let n = 0; n < count; n += 1) {
    // Inside the cell: within a little under half a parcel of its site, which every cell reaches
    // in every direction — and not with its foot in a river that crosses the parcel.
    const angle = hash(column, row, 7003 + n * 7) * Math.PI * 2;
    const reach = Math.sqrt(hash(column, row, 7005 + n * 7)) * PARCEL * 0.42;
    const x = site.x + Math.cos(angle) * reach;
    const y = site.y + Math.sin(angle) * reach;
    if (isWater(biomeAt(world.seed, { x, y }))) continue;
    trees.push({ x, y, pick: hash(column, row, 7009 + n * 7) });
  }

  if (known.size > 60_000) known.clear();
  known.set(key, trees);
  return trees;
}
