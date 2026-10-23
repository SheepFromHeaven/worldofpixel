import { hash2, noise2 } from './rng.ts';
import { Biome } from './types.ts';
import type { WorldField } from './terrain/worldfield.ts';
import { Cover } from './world.ts';

interface Mix {
  readonly tree: number;
  readonly bush: number;
  readonly scrub: number;
  readonly boulder: number;
  readonly grass: number;
}

const NOTHING: Mix = { tree: 0, bush: 0, scrub: 0, boulder: 0, grass: 0 };

const MIX: readonly Mix[] = [
  { tree: 0.02, bush: 0.04, scrub: 0.08, boulder: 0.004, grass: 0.55 },
  { tree: 0.34, bush: 0.1, scrub: 0.12, boulder: 0.006, grass: 0.3 },
  { tree: 0.01, bush: 0.03, scrub: 0.1, boulder: 0.06, grass: 0.22 },
  { tree: 0.03, bush: 0.12, scrub: 0.26, boulder: 0.002, grass: 0.4 },
  { tree: 0.004, bush: 0.02, scrub: 0.07, boulder: 0.03, grass: 0.16 },
  { tree: 0.002, bush: 0.012, scrub: 0.03, boulder: 0.02, grass: 0.04 },
  NOTHING,
  NOTHING,
  NOTHING,
];

const CLUMP_WAVE = 14;

export function coverFor(seed: number, field: WorldField): Uint8Array {
  const { grid } = field;
  const cover = new Uint8Array(grid.count);

  for (let row = 0; row < grid.rows; row += 1) {
    const y = grid.y(row);
    const at = row * grid.columns;

    for (let column = 0; column < grid.columns; column += 1) {
      const mix = MIX[field.biome[at + column]!];
      if (!mix || mix === NOTHING) continue;

      const x = grid.x(column);
      const clump = 0.5 + noise2(x / CLUMP_WAVE, y / CLUMP_WAVE, seed + 331);
      const roll = hash2(column, row, seed + 977);

      let edge = mix.tree * clump;
      if (roll < edge) {
        cover[at + column] = Cover.Tree;
        continue;
      }
      edge += mix.bush * clump;
      if (roll < edge) {
        cover[at + column] = Cover.Bush;
        continue;
      }
      edge += mix.boulder;
      if (roll < edge) {
        cover[at + column] = Cover.Boulder;
        continue;
      }
      edge += mix.scrub;
      if (roll < edge) {
        cover[at + column] = Cover.Scrub;
        continue;
      }
      edge += mix.grass;
      if (roll < edge) cover[at + column] = Cover.Grass;
    }
  }

  return cover;
}

export const growsOn = (biome: Biome): boolean => MIX[biome] !== NOTHING;
