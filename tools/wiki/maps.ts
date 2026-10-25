import { BIOME_COLORS } from '../../src/render/palette.ts';
import { altitudeOf } from '../../src/sim/terrain/climate.ts';
import { SEA_LEVEL } from '../../src/sim/terrain/heightmap.ts';
import type { Rgb } from './raster.ts';
import { hex, ramp } from './raster.ts';

export const BIOME_RGB: readonly Rgb[] = BIOME_COLORS.map(hex);

export const PAPER_RGB = hex('#f4f1ea');

const DEEP: Rgb = [38, 74, 104];
const SHALLOW: Rgb = [122, 166, 189];
const LOWLAND: Rgb = [138, 166, 92];
const FOOTHILL: Rgb = [201, 180, 120];
const ROCK: Rgb = [140, 124, 104];
const SNOW: Rgb = [244, 244, 240];

export function hypsometric(height: number): Rgb {
  if (height < SEA_LEVEL) return ramp([DEEP, SHALLOW], height / SEA_LEVEL);
  const altitude = altitudeOf(height);
  return ramp([LOWLAND, FOOTHILL, ROCK, SNOW], altitude / 0.9);
}

const COLD: Rgb = [58, 92, 160];
const MILD: Rgb = [236, 232, 214];
const HOT: Rgb = [192, 81, 64];

export const heat = (celsius: number): Rgb => ramp([COLD, MILD, HOT], (celsius + 40) / 80);

const DRY: Rgb = [236, 224, 196];
const DAMP: Rgb = [90, 150, 190];
const SOAKED: Rgb = [30, 60, 120];

export const wetness = (t: number): Rgb => ramp([DRY, DAMP, SOAKED], t);

export const mono = (t: number, from: Rgb = PAPER_RGB, to: Rgb = [59, 53, 44]): Rgb => ramp([from, to], t);
