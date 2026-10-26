import { hash2, noise2 } from './rng.ts';
import { Biome } from './types.ts';
import { Cover } from './covers.ts';

export interface Affinity {
  readonly tree: number;
  readonly bush: number;
  readonly scrub: number;
  readonly boulder: number;
  readonly grass: number;
}

const NOTHING: Affinity = { tree: 0, bush: 0, scrub: 0, boulder: 0, grass: 0 };

const AFFINITY: readonly Affinity[] = [
  { tree: 0.3, bush: 0.8, scrub: 0.8, boulder: 0.5, grass: 1 },
  { tree: 1, bush: 1, scrub: 0.7, boulder: 0.6, grass: 0.8 },
  { tree: 2, bush: 0.5, scrub: 1, boulder: 3, grass: 0.8 },
  { tree: 0.3, bush: 1.4, scrub: 1.4, boulder: 0.2, grass: 1 },
  { tree: 0.15, bush: 0.4, scrub: 0.8, boulder: 2, grass: 0.7 },
  { tree: 0.1, bush: 0.4, scrub: 1.2, boulder: 2.5, grass: 0.5 },
  { tree: 0.02, bush: 0.15, scrub: 0.45, boulder: 4, grass: 0.25 },
  { tree: 0.1, bush: 0.35, scrub: 0.9, boulder: 3, grass: 0.45 },
  { tree: 0.03, bush: 0.12, scrub: 0.3, boulder: 3.5, grass: 0.18 },
  { tree: 0, bush: 0, scrub: 0.12, boulder: 0.4, grass: 0.04 },
  { tree: 0.02, bush: 0.12, scrub: 0.5, boulder: 2.5, grass: 0.22 },
  NOTHING,
  NOTHING,
  NOTHING,
];

const TREE_DENSITY = 0.42;

const BUSH_DENSITY = 0.12;

const SCRUB_DENSITY = 0.22;

const BOULDER_DENSITY = 0.03;

const GRASS_DENSITY = 0.6;

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const hump = (centre: number, width: number, x: number): number => Math.max(0, 1 - Math.abs(x - centre) / width);

export interface Densities {
  readonly tree: number;
  readonly bush: number;
  readonly scrub: number;
  readonly boulder: number;
  readonly grass: number;
}

export const FORMS = ['tree', 'bush', 'scrub', 'boulder', 'grass'] as const;

export const affinityOf = (biome: Biome): Affinity => AFFINITY[biome] ?? NOTHING;

export const densitiesAt = (affinity: Affinity, fertility: number): Densities => ({
  tree: TREE_DENSITY * affinity.tree * smooth(0.12, 0.55, fertility),
  bush: BUSH_DENSITY * affinity.bush * (0.25 + 0.75 * hump(0.6, 0.55, fertility)),
  scrub: SCRUB_DENSITY * affinity.scrub * (0.2 + 0.8 * hump(0.3, 0.45, fertility)),
  boulder: BOULDER_DENSITY * affinity.boulder * (1.4 - fertility),
  grass: GRASS_DENSITY * affinity.grass * (0.15 + 0.85 * smooth(0.04, 0.4, fertility)),
});

const CLUMP_WAVE = 14;

export function placeOf(mix: Densities, clump: number, roll: number): Cover {
  let edge = mix.tree * clump;
  if (roll < edge) return Cover.Tree;
  edge += mix.bush * clump;
  if (roll < edge) return Cover.Bush;
  edge += mix.boulder;
  if (roll < edge) return Cover.Boulder;
  edge += mix.scrub;
  if (roll < edge) return Cover.Scrub;
  edge += mix.grass;
  return roll < edge ? Cover.Grass : Cover.Bare;
}

export const clumpAt = (seed: number, x: number, y: number): number =>
  0.5 + noise2(x / CLUMP_WAVE, y / CLUMP_WAVE, seed + 331);

export const rollAt = (seed: number, column: number, row: number): number => hash2(column, row, seed + 977);

export const growsOn = (biome: Biome): boolean => AFFINITY[biome] !== NOTHING;
