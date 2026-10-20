import { CLEAR, alphaOf } from './color.ts';
import type { Rgba } from './color.ts';

/** A sprite in progress: one packed colour per cell, square, in the size it was authored at. */
export interface Grid {
  readonly size: number;
  readonly cells: Uint32Array;
}

export function createGrid(size: number): Grid {
  return { size, cells: new Uint32Array(size * size).fill(CLEAR) };
}

export function at(grid: Grid, x: number, y: number): Rgba {
  if (x < 0 || y < 0 || x >= grid.size || y >= grid.size) return CLEAR;
  return grid.cells[y * grid.size + x] ?? CLEAR;
}

export function put(grid: Grid, x: number, y: number, color: Rgba): void {
  if (x < 0 || y < 0 || x >= grid.size || y >= grid.size) return;
  grid.cells[y * grid.size + x] = color;
}

const opaque = (grid: Grid, x: number, y: number): boolean => alphaOf(at(grid, x, y)) > 0;

/**
 * Inks the silhouette.
 *
 * A tile goes down on whatever the map is already drawing — a biome wash, another tile — and
 * without a line round it the shaded edge of the sprite and the ground behind it are two colours
 * of similar weight meeting, which reads as a stain rather than as a thing. Laid last, over the
 * shading, since an outline the shading can overwrite is not an outline.
 */
export function outline(grid: Grid, color: Rgba): void {
  const edges: number[] = [];

  for (let y = 0; y < grid.size; y += 1) {
    for (let x = 0; x < grid.size; x += 1) {
      if (!opaque(grid, x, y)) continue;
      const open =
        !opaque(grid, x - 1, y) || !opaque(grid, x + 1, y) ||
        !opaque(grid, x, y - 1) || !opaque(grid, x, y + 1);
      if (open) edges.push(y * grid.size + x);
    }
  }

  for (const cell of edges) grid.cells[cell] = color;
}

/** A detail too small to be worth a region of its own: a pebble, a tuft, a glint. */
export type Stamp = readonly (readonly [number, number, Rgba])[];

export function stamp(grid: Grid, x: number, y: number, cells: Stamp): void {
  for (const [dx, dy, color] of cells) put(grid, x + dx, y + dy, color);
}

/**
 * The grid at a whole-number magnification, as RGBA bytes.
 *
 * Whole-number is not a preference. Every colour here sits on a cell, and a fractional scale
 * resamples the cells into each other — which is the one thing that stops pixel art being pixel
 * art. `render/sprites.ts` steps the tile back down to this grid before drawing it for the same
 * reason.
 */
export function magnify(grid: Grid, scale: number): Uint8Array {
  if (!Number.isInteger(scale) || scale < 1) {
    throw new Error(`magnify: ${scale} is not a whole number of cells`);
  }

  const size = grid.size * scale;
  const out = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const color = at(grid, Math.floor(x / scale), Math.floor(y / scale));
      const to = (y * size + x) * 4;
      out[to] = (color >>> 24) & 0xff;
      out[to + 1] = (color >>> 16) & 0xff;
      out[to + 2] = (color >>> 8) & 0xff;
      out[to + 3] = color & 0xff;
    }
  }

  return out;
}

/**
 * Lays one drawing over another with its top-left at `x, y`. Opaque cells replace what is under
 * them; translucent ones — a cast shadow — only land on bare ground, so a figure's shadow never
 * darkens the well it is standing in front of.
 */
export function layer(grid: Grid, top: Grid, x: number, y: number): void {
  for (let ty = 0; ty < top.size; ty += 1) {
    for (let tx = 0; tx < top.size; tx += 1) {
      const color = at(top, tx, ty);
      const alpha = alphaOf(color);
      if (alpha === 0) continue;
      if (alpha < 0xff && alphaOf(at(grid, x + tx, y + ty)) > 0) continue;
      put(grid, x + tx, y + ty, color);
    }
  }
}

/** A line one cell wide between two cells — a rope, a handle, a shaft. */
export function line(grid: Grid, x0: number, y0: number, x1: number, y1: number, color: Rgba): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i += 1) {
    put(grid, Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), color);
  }
}
