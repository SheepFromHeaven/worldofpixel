import { Aqua, DEPTH_UNIT_METRES, flowOf } from '../../aquatic.ts';
import { FRESH_WATER_FROM, SEA_WATER } from '../../mammals/species.ts';
import { Biome } from '../../types.ts';
import type { World } from '../../world.ts';

export type MammalHabitatSample = [number, number, number, number];

export interface MammalExtras {
  rough: number;
  soil: number;
}

const SHELTER: readonly number[] = [0, 0.1, 0.5, 0.75, 1, 0.55, 0.7];

const FORAGE: readonly number[] = [0.15, 1, 0.7, 0.45, 0.25, 0.1, 0.3];

const ROUGH: readonly number[] = [0, 0, 0.1, 0.1, 0.1, 1, 0.2];

const BIOME_ROUGH: readonly number[] = [0, 0.1, 0.8, 0, 0.3, 0.1, 0.5, 0, 0];

const BIOME_SOIL: readonly number[] = [1, 0.9, 0.3, 0.7, 0.3, 0.5, 0, 0, 0];

const NEAR_TILES = 3;
const FAR_TILES = 6;
const NEAR_SHARE = 0.6;
const BANK_GAIN = 2.2;
const SHELTER_REACH = 4;
const SHELTER_NEIGHBOURS = 0.5;
const WORN_FORAGE_LOSS = 0.3;
const ECO_FORAGE = 0.7;
const DEEP_FROM_METRES = 4;
const DEEP_TO_METRES = 60;
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

const bankOf = (world: World, column: number, row: number, wet: boolean): number =>
  Math.min(1, BANK_GAIN * (NEAR_SHARE * ringShare(world, column, row, NEAR_TILES, wet) + (1 - NEAR_SHARE) * ringShare(world, column, row, FAR_TILES, wet)));

const shelterAround = (world: World, column: number, row: number): number => {
  let found = 0;
  for (const [dc, dr] of RING) {
    const c = column + dc * SHELTER_REACH;
    const r = row + dr * SHELTER_REACH;
    if (inside(world, c, r)) found += SHELTER[world.cover[r * world.grid.columns + c]!] ?? 0;
  }
  return found / RING.length;
};

export function mammalHabitatAt(world: World, column: number, row: number, out: MammalHabitatSample): MammalHabitatSample {
  const tile = row * world.grid.columns + column;
  const biome = world.biome[tile]!;

  if (biome === Biome.Ocean) {
    const metres = world.depth[tile]! * DEPTH_UNIT_METRES;
    const aqua = world.aqua[tile]!;
    out[0] = smooth(DEEP_FROM_METRES, DEEP_TO_METRES, metres);
    out[1] = aqua === Aqua.Seagrass || aqua === Aqua.Kelp ? 1 : 0.25;
    out[2] = SEA_WATER;
    out[3] = bankOf(world, column, row, false);
    return out;
  }

  if (world.river[tile] === 1 || biome === Biome.Lake) {
    const flow = world.river[tile] === 1 ? flowOf(world.flow[tile]!) : 0;
    const metres = world.depth[tile]! * DEPTH_UNIT_METRES;
    const calm = 1 - smooth(0.4, 1.4, flow);
    const planted = world.aqua[tile] === Aqua.Reeds || world.aqua[tile] === Aqua.Lily || world.aqua[tile] === Aqua.Weed;
    out[0] = smooth(1, 8, metres);
    out[1] = planted ? 1 : 0.2;
    out[2] = FRESH_WATER_FROM + (1 - FRESH_WATER_FROM) * calm;
    out[3] = bankOf(world, column, row, false);
    return out;
  }

  const cover = world.cover[tile]!;
  const worn = world.wear[tile]! / 255;
  out[0] = Math.min(1, Math.max(SHELTER[cover] ?? 0, SHELTER_NEIGHBOURS * shelterAround(world, column, row)));
  const eco = world.eco[tile]! / 255;
  out[1] = Math.min(1, Math.max(0, (FORAGE[cover] ?? 0) * 0.5 + ECO_FORAGE * eco - WORN_FORAGE_LOSS * worn));
  out[2] = 0;
  out[3] = bankOf(world, column, row, true);
  return out;
}

export function mammalExtrasAt(world: World, column: number, row: number, out: MammalExtras): MammalExtras {
  const tile = row * world.grid.columns + column;
  const biome = world.biome[tile]!;
  const cover = world.cover[tile]!;
  out.rough = Math.min(1, Math.max(BIOME_ROUGH[biome] ?? 0, ROUGH[cover] ?? 0));
  out.soil = (BIOME_SOIL[biome] ?? 0) * (1 - 0.8 * (ROUGH[cover] ?? 0));
  return out;
}
