import { hash2, noise2 } from './rng.ts';
import { Biome } from './types.ts';
import type { WorldField } from './terrain/worldfield.ts';
import { ECO_FULL } from './eco.ts';
import { Cover } from './world.ts';

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

export function coverFor(seed: number, field: WorldField, eco: Uint8Array): Uint8Array {
  const { grid } = field;
  const cover = new Uint8Array(grid.count);

  for (let row = 0; row < grid.rows; row += 1) {
    const y = grid.y(row);
    const at = row * grid.columns;

    for (let column = 0; column < grid.columns; column += 1) {
      const affinity = AFFINITY[field.biome[at + column]!];
      if (!affinity || affinity === NOTHING) continue;

      const mix = densitiesAt(affinity, eco[at + column]! / ECO_FULL);
      cover[at + column] = placeOf(mix, clumpAt(seed, grid.x(column), y), rollAt(seed, column, row));
    }
  }

  return cover;
}

export const growsOn = (biome: Biome): boolean => AFFINITY[biome] !== NOTHING;
