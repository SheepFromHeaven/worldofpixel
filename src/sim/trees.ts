import type { Vec2 } from './geometry.ts';
import { PARCEL, parcelIndex, siteOf } from './terrain/parcels.ts';
import { biomeAt, groundBiomeAt } from './terrain/terrain.ts';
import { Biome } from './types.ts';
import type { CellId } from './types.ts';
import type { GameWorld } from './world.ts';
import { isWater } from './terrain/worldfield.ts';

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
