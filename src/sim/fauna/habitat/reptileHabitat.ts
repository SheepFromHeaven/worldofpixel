import { Aqua, DEPTH_UNIT_METRES, flowOf } from '../../aquatic.ts';
import { FRESH_WATER_FROM, SEA_WATER } from '../../reptiles/species.ts';
import { Biome } from '../../types.ts';
import type { World } from '../../world.ts';

export type ReptileHabitatSample = [number, number, number, number];

const COVER_SHELTER: readonly number[] = [0.05, 0.4, 0.55, 0.75, 0.85, 0.9, 1];

const COVER_OPEN: readonly number[] = [1, 0.45, 0.5, 0.2, 0.1, 0.9, 0.6];

const NEAR_TILES = 3;
const FAR_TILES = 6;
const NEAR_SHARE = 0.6;
const BANK_GAIN = 2.2;
const SEA_BANK_SHARE = 0.8;
const WORN_SHELTER_LOSS = 0.8;
const DAMP_COOLING = 0.6;
const RING: readonly (readonly [number, number])[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

type Test = (world: World, column: number, row: number) => boolean;

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const inside = (world: World, column: number, row: number): boolean => column >= 0 && row >= 0 && column < world.grid.columns && row < world.grid.rows;

const isFresh: Test = (world, column, row) => {
  if (!inside(world, column, row)) return false;
  const tile = row * world.grid.columns + column;
  return world.river[tile] === 1 || world.biome[tile] === Biome.Lake;
};

const isSea: Test = (world, column, row) => inside(world, column, row) && world.biome[row * world.grid.columns + column] === Biome.Ocean;

const isLand: Test = (world, column, row) => inside(world, column, row) && !isFresh(world, column, row) && !isSea(world, column, row);

const ringShares = (world: World, column: number, row: number, reach: number, fresh: boolean): number => {
  let found = 0;
  for (const [dc, dr] of RING) {
    const c = column + dc * reach;
    const r = row + dr * reach;
    if (fresh ? isFresh(world, c, r) : isSea(world, c, r)) found += 1;
  }
  return found / RING.length;
};

const landBank = (world: World, column: number, row: number): number => {
  let found = 0;
  for (const [dc, dr] of RING) {
    if (isLand(world, column + dc * NEAR_TILES, row + dr * NEAR_TILES)) found += NEAR_SHARE;
    if (isLand(world, column + dc * FAR_TILES, row + dr * FAR_TILES)) found += 1 - NEAR_SHARE;
  }
  return found / RING.length;
};

const waterBank = (world: World, column: number, row: number): number => {
  const fresh = NEAR_SHARE * ringShares(world, column, row, NEAR_TILES, true) + (1 - NEAR_SHARE) * ringShares(world, column, row, FAR_TILES, true);
  if (fresh > 0.99) return fresh;
  const sea = NEAR_SHARE * ringShares(world, column, row, NEAR_TILES, false) + (1 - NEAR_SHARE) * ringShares(world, column, row, FAR_TILES, false);
  return Math.max(fresh, SEA_BANK_SHARE * sea);
};

export function reptileHabitatAt(world: World, column: number, row: number, out: ReptileHabitatSample): ReptileHabitatSample {
  const tile = row * world.grid.columns + column;
  const biome = world.biome[tile]!;
  const metres = world.depth[tile]! * DEPTH_UNIT_METRES;
  const aqua = world.aqua[tile]!;

  if (biome === Biome.Ocean) {
    out[0] = SEA_WATER;
    out[1] = aqua === Aqua.Seagrass || aqua === Aqua.Kelp ? 1 : 0.2;
    out[2] = 1 - smooth(1, 14, metres);
    out[3] = 0;
    return out;
  }

  if (world.river[tile] === 1 || biome === Biome.Lake) {
    const flow = world.river[tile] === 1 ? flowOf(world.flow[tile]!) : 0;
    const calm = (1 - smooth(0.4, 1.4, flow)) * (1 - 0.6 * smooth(2, 7, metres));
    out[0] = FRESH_WATER_FROM + (1 - FRESH_WATER_FROM) * calm;
    out[1] = aqua === Aqua.Reeds || aqua === Aqua.Lily || aqua === Aqua.Algae || aqua === Aqua.Weed ? 1 : 0.2;
    out[2] = 1 - smooth(0.4, 2.5, metres);
    out[3] = Math.min(1, BANK_GAIN * landBank(world, column, row));
    return out;
  }

  const damp = world.damp[tile]! / 255;
  const cover = world.cover[tile]!;
  out[0] = 0;
  out[1] = (COVER_SHELTER[cover] ?? 0) * (1 - WORN_SHELTER_LOSS * (world.wear[tile]! / 255));
  out[2] = (COVER_OPEN[cover] ?? 0) * (1 - DAMP_COOLING * damp);
  out[3] = Math.min(1, BANK_GAIN * waterBank(world, column, row));
  return out;
}
