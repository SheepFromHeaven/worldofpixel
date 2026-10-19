import { at } from '../pixel/grid.ts';
import type { Grid } from '../pixel/grid.ts';

/**
 * A grid as a canvas of exactly its own cells, which is the only honest size for it. Anything
 * that wants it bigger scales it up by a whole number with smoothing off, the way the game does.
 */
export function toCanvas(grid: Grid): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = grid.size;
  canvas.height = grid.size;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const image = ctx.createImageData(grid.size, grid.size);
  for (let y = 0; y < grid.size; y += 1) {
    for (let x = 0; x < grid.size; x += 1) {
      const color = at(grid, x, y);
      const to = (y * grid.size + x) * 4;
      image.data[to] = (color >>> 24) & 0xff;
      image.data[to + 1] = (color >>> 16) & 0xff;
      image.data[to + 2] = (color >>> 8) & 0xff;
      image.data[to + 3] = color & 0xff;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function blit(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  x: number,
  y: number,
  size: number,
): void {
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, x, y, size, size);
  ctx.imageSmoothingEnabled = smoothing;
}
