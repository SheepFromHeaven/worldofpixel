import { noise2 } from './rng.ts';
import { altitudeOf } from './terrain/climate.ts';
import { Biome } from './types.ts';
import type { World } from './world.ts';

export const TreeKind = ['oak', 'pine', 'snowpine', 'willow', 'acacia', 'dead'] as const;

export type TreeKind = (typeof TreeKind)[number];

const STAND_WAVE = 44;

const SHARPEN = 2.5;

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const clamp = (x: number): number => Math.min(1, Math.max(0, x));

export function treeWeights(world: World, tile: number, x: number, y: number): readonly number[] {
  const biome = world.biome[tile]!;
  const altitude = altitudeOf(world.field.height[tile]!);
  const celsius = world.field.temperature[tile]!;
  const damp = world.damp[tile]! / 255;

  const stand = noise2(x / STAND_WAVE, y / STAND_WAVE, world.seed + 811);
  const cold = 1 - smooth(3, 11, celsius);
  const high = smooth(0.2, 0.42, altitude);
  const tundra = biome === Biome.Tundra ? 1 : 0;
  const lean = Math.max(cold, high, tundra);
  const conifer = clamp(lean * (1 + (stand - 0.5) * 0.9));
  const snowy = Math.max(tundra, 1 - smooth(-5, 1, celsius));

  const marsh = biome === Biome.Marsh ? 1 : 0;
  const bank = smooth(0.78, 0.95, damp) * 0.5;
  const wet = Math.max(marsh, bank) * smooth(-2, 5, celsius) * (1 - smooth(0.3, 0.5, altitude));
  const warm = smooth(17, 24, celsius);
  const dry = 1 - smooth(0.2, 0.6, damp);
  const arid = biome === Biome.Desert || biome === Biome.Meadow ? 1 : 0.3;

  const dead = marsh * 0.9 + (biome === Biome.Desert ? 0.5 : 0) + tundra * 0.2 + 0.01;

  return [
    (1 - conifer) * (1 - wet) * (1 - 0.7 * warm * dry) + 0.001,
    conifer * (1 - snowy) * (1 - 0.7 * wet),
    conifer * snowy,
    wet * 2.5,
    warm * dry * arid * 0.8,
    dead,
  ].map((weight) => Math.max(0, weight) ** SHARPEN);
}

export function treeKindAt(world: World, tile: number, x: number, y: number, roll: number): TreeKind {
  const weights = treeWeights(world, tile, x, y);
  let total = 0;
  for (const weight of weights) total += weight;

  let left = roll * total;
  for (let kind = 0; kind < weights.length; kind += 1) {
    left -= weights[kind]!;
    if (left < 0) return TreeKind[kind]!;
  }
  return 'oak';
}
