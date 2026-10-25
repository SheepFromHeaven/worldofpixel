import { Aqua } from '../sim/aquatic.ts';
import { Cover } from '../sim/covers.ts';
import type { TileIndex } from '../sim/grid.ts';
import { Biome } from '../sim/types.ts';
import type { World } from '../sim/world.ts';
import type { Grain } from './groundSprites.ts';
import { patchiness } from './groundSprites.ts';

const FLOWER_GRAIN: readonly Grain[] = [
  { salt: 1, scale: 13, cover: 0.22 },
  { salt: 11, scale: 8, cover: 0.6 },
];

const NECTAR_BY_BIOME: readonly number[] = [1, 0.35, 0.3, 0.35, 0.15, 0.1];

const FLOWER_SHARE = 0.6;
const SHRUB_NECTAR = 0.25;
const OCEAN_WATER = 0.3;

export type HabitatSample = [number, number, number, number];

const FOLIAGE_BY_COVER: readonly number[] = [0, 0.6, 0.6, 0.8, 1, 0, 0.3];

const GROUND_BY_COVER: readonly number[] = [1, 0.15, 0.2, 0.1, 0.05, 0.6, 0.8];

export function habitatAt(world: World, column: number, row: number, out: HabitatSample): HabitatSample {
  const tile: TileIndex = row * world.grid.columns + column;
  const biome = world.biome[tile]!;
  const wet = world.river[tile] === 1 || biome === Biome.Lake;
  if (wet || biome === Biome.Ocean) {
    out[0] = world.aqua[tile] === Aqua.Lily ? 0.5 : 0;
    out[1] = world.aqua[tile] === Aqua.Reeds ? 0.5 : 0;
    out[2] = wet ? 1 : OCEAN_WATER;
    out[3] = 0;
    return out;
  }

  const cover = world.cover[tile]!;
  const flowers = NECTAR_BY_BIOME[biome] ?? 0;
  let nectar = 0;
  if (flowers > 0 && cover !== Cover.Tree) nectar = flowers * Math.min(1, patchiness(world.seed, FLOWER_GRAIN, column, row) * FLOWER_SHARE);
  const shrub = world.plants.speciesAt(tile, 'under');
  if (shrub?.fruit) nectar += SHRUB_NECTAR;

  out[0] = Math.min(1, nectar);
  out[1] = FOLIAGE_BY_COVER[cover] ?? 0;
  out[2] = world.damp[tile]! / 255 + (world.aqua[tile] === Aqua.Reeds ? 0.2 : 0);
  out[3] = Math.min(1, (GROUND_BY_COVER[cover] ?? 0) + world.wear[tile]! / 255);
  return out;
}
