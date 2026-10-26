import { Aqua, DEPTH_UNIT_METRES, flowOf } from '../../aquatic.ts';
import { FRESH_WATER_FROM, SEA_WATER } from '../../birds/species.ts';
import { Biome } from '../../types.ts';
import type { World } from '../../world.ts';

export type BirdHabitatSample = [number, number, number, number];

const CANOPY: readonly number[] = [0, 0, 0.25, 0.6, 1, 0, 0.35];

const OPEN: readonly number[] = [0.6, 1, 0.7, 0.3, 0.05, 0.4, 0.5];

const NEAR_TILES = 3;
const FAR_TILES = 6;
const NEAR_SHARE = 0.6;
const EDGE_GAIN = 2.2;
const CANOPY_REACH = 4;
const CANOPY_NEIGHBOURS = 0.6;
const WORN_OPEN_GAIN = 0.2;
const RING: readonly (readonly [number, number])[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const inside = (world: World, column: number, row: number): boolean => column >= 0 && row >= 0 && column < world.grid.columns && row < world.grid.rows;

const isWet = (world: World, column: number, row: number): boolean => {
  if (!inside(world, column, row)) return false;
  const tile = row * world.grid.columns + column;
  return world.river[tile] === 1 || world.biome[tile] === Biome.Lake || world.biome[tile] === Biome.Ocean;
};

const ringShare = (world: World, column: number, row: number, reach: number, wet: boolean): number => {
  let found = 0;
  for (const [dc, dr] of RING) {
    const c = column + dc * reach;
    const r = row + dr * reach;
    if (inside(world, c, r) && isWet(world, c, r) === wet) found += 1;
  }
  return found / RING.length;
};

const edgeOf = (world: World, column: number, row: number, wet: boolean): number =>
  Math.min(1, EDGE_GAIN * (NEAR_SHARE * ringShare(world, column, row, NEAR_TILES, wet) + (1 - NEAR_SHARE) * ringShare(world, column, row, FAR_TILES, wet)));

const treesAround = (world: World, column: number, row: number): number => {
  let found = 0;
  for (const [dc, dr] of RING) {
    const c = column + dc * CANOPY_REACH;
    const r = row + dr * CANOPY_REACH;
    if (inside(world, c, r)) found += CANOPY[world.cover[r * world.grid.columns + c]!] ?? 0;
  }
  return found / RING.length;
};

export function birdHabitatAt(world: World, column: number, row: number, out: BirdHabitatSample): BirdHabitatSample {
  const tile = row * world.grid.columns + column;
  const biome = world.biome[tile]!;

  if (biome === Biome.Ocean) {
    out[0] = 0;
    out[1] = 0;
    out[2] = SEA_WATER;
    out[3] = edgeOf(world, column, row, false);
    return out;
  }

  if (world.river[tile] === 1 || biome === Biome.Lake) {
    const flow = world.river[tile] === 1 ? flowOf(world.flow[tile]!) : 0;
    const metres = world.depth[tile]! * DEPTH_UNIT_METRES;
    const calm = (1 - smooth(0.4, 1.4, flow)) * (1 - 0.5 * smooth(2, 7, metres));
    const reeds = world.aqua[tile] === Aqua.Reeds || world.aqua[tile] === Aqua.Lily;
    out[0] = 0;
    out[1] = 0;
    out[2] = FRESH_WATER_FROM + (1 - FRESH_WATER_FROM) * (reeds ? Math.max(calm, 0.8) : calm);
    out[3] = edgeOf(world, column, row, false);
    return out;
  }

  const cover = world.cover[tile]!;
  const worn = world.wear[tile]! / 255;
  out[0] = Math.min(1, Math.max(CANOPY[cover] ?? 0, CANOPY_NEIGHBOURS * treesAround(world, column, row)));
  out[1] = Math.min(1, (OPEN[cover] ?? 0) + WORN_OPEN_GAIN * worn);
  out[2] = 0;
  out[3] = edgeOf(world, column, row, true);
  return out;
}
