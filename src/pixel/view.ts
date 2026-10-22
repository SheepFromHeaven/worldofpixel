import type { Rgba } from './color.ts';
import type { Mask } from './field.ts';
import { blob } from './field.ts';
import type { Grid } from './grid.ts';
import { at, put } from './grid.ts';

export const TILT = Math.SQRT1_2;

export const TILE_CELLS = 32;
export const FLOOR_TOP = 5;
export const FLOOR_ROWS = Math.round(TILE_CELLS * TILT);

export function groundShadow(footX: number, footY: number, width: number, seed: number, reach = 0.35): Mask {
  return blob(footX + width * reach, footY, width * 0.55, width * 0.55 * TILT * 0.6, 0.08, seed);
}

export function castShadow(grid: Grid, shadow: Mask, color: Rgba): void {
  for (let y = 0; y < grid.size; y += 1) {
    for (let x = 0; x < grid.size; x += 1) {
      if (shadow(x, y) && (at(grid, x, y) & 0xff) === 0) put(grid, x, y, color);
    }
  }
}
