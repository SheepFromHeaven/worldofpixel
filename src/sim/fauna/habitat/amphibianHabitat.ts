import { Aqua, DEPTH_UNIT_METRES, flowOf } from '../../aquatic.ts';
import { Biome } from '../../types.ts';
import type { World } from '../../world.ts';

export type AmphibianHabitatSample = [number, number, number, number];

const SHELTER_BY_COVER: readonly number[] = [0.05, 0.45, 0.6, 0.75, 0.85, 0.9, 1];

export const WATER_FLAG = 0.004;

const WATER_FLOOR = 2 / 255;
const NEAR_TILES = 3;
const FAR_TILES = 6;
const NEAR_SHARE = 0.6;
const BANK_GAIN = 2.2;
const WORN_SHELTER_LOSS = 0.8;
const RING: readonly (readonly [number, number])[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const isFresh = (world: World, column: number, row: number): boolean => {
  const { grid } = world;
  if (column < 0 || row < 0 || column >= grid.columns || row >= grid.rows) return false;
  const tile = row * grid.columns + column;
  return world.river[tile] === 1 || world.biome[tile] === Biome.Lake;
};

const freshShare = (world: World, column: number, row: number, reach: number): number => {
  let found = 0;
  for (const [dc, dr] of RING) if (isFresh(world, column + dc * reach, row + dr * reach)) found += 1;
  return found / RING.length;
};

export const pondQuality = (still: number, depthMetres: number, vegetated: boolean): number =>
  still * (1 - smooth(0.7, 1.8, depthMetres)) * (vegetated ? 1 : 0.55);

export function amphibianHabitatAt(world: World, column: number, row: number, out: AmphibianHabitatSample): AmphibianHabitatSample {
  const tile = row * world.grid.columns + column;
  const biome = world.biome[tile]!;
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  if (biome === Biome.Ocean) {
    out[0] = WATER_FLOOR;
    return out;
  }

  if (world.river[tile] === 1 || biome === Biome.Lake) {
    const aqua = world.aqua[tile]!;
    const flow = world.river[tile] === 1 ? flowOf(world.flow[tile]!) : 0;
    const vegetated = aqua === Aqua.Reeds || aqua === Aqua.Lily || aqua === Aqua.Algae || aqua === Aqua.Weed;
    out[0] = Math.max(WATER_FLOOR, pondQuality(1 - smooth(0.4, 1.4, flow), world.depth[tile]! * DEPTH_UNIT_METRES, vegetated));
    return out;
  }

  const near = freshShare(world, column, row, NEAR_TILES);
  const far = freshShare(world, column, row, FAR_TILES);
  out[1] = (SHELTER_BY_COVER[world.cover[tile]!] ?? 0) * (1 - WORN_SHELTER_LOSS * (world.wear[tile]! / 255));
  out[2] = world.damp[tile]! / 255;
  out[3] = Math.min(1, BANK_GAIN * (NEAR_SHARE * near + (1 - NEAR_SHARE) * far));
  return out;
}
