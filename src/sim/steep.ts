import { altitudeOf, PEAK_METRES } from './terrain/climate.ts';
import type { WorldField } from './terrain/worldfield.ts';
import { isWater } from './terrain/worldfield.ts';
import { Biome } from './types.ts';

export const STEEP_REACH = 2;

export const CLIFF_FROM = 45;

export const CLIFF_FULL = 110;

export const STEEP_ONE = 255;

export const CLIFF_FACE = 128;

export const SHEER = 200;

export const CLIFF_BARREN = 0.92;

export const CLIFF_SEED_LOSS = 1;

export const CLIFF_PACE = 0.7;

export const CLIFF_MARK = 1 / 255;

export const CLIFF_SEEN = 0.002;

export const cliffMarked = (steep: number): number => (steep >= SHEER ? CLIFF_MARK : 0);

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export const cliffOf = (metresPerTile: number): number => smooth(CLIFF_FROM, CLIFF_FULL, metresPerTile);

export const metresOf = (height: number): number => altitudeOf(height) * PEAK_METRES;

const built = new WeakMap<WorldField, Uint8Array>();

export function steepFor(field: WorldField): Uint8Array {
  const known = built.get(field);
  if (known) return known;

  const { grid, height, biome } = field;
  const steep = new Uint8Array(grid.count);
  const last = grid.columns - 1;
  const bottom = grid.rows - 1;

  for (let row = 0; row < grid.rows; row += 1) {
    const up = Math.max(row - STEEP_REACH, 0);
    const down = Math.min(row + STEEP_REACH, bottom);
    for (let column = 0; column < grid.columns; column += 1) {
      const i = row * grid.columns + column;
      if (isWater(biome[i] as Biome)) continue;
      const west = Math.max(column - STEEP_REACH, 0);
      const east = Math.min(column + STEEP_REACH, last);
      const dx = (metresOf(height[grid.at(east, row)]!) - metresOf(height[grid.at(west, row)]!)) / (east - west || 1);
      const dy = (metresOf(height[grid.at(column, down)]!) - metresOf(height[grid.at(column, up)]!)) / (down - up || 1);
      steep[i] = Math.round(cliffOf(Math.hypot(dx, dy)) * STEEP_ONE);
    }
  }

  built.set(field, steep);
  return steep;
}
