import type { Vec2 } from '../geometry.ts';
import { MARGIN_TILES, TILE, TileGrid, WORLD_TILES } from '../grid.ts';
import { noise2 } from '../rng.ts';

export type FieldGrid = TileGrid;

export const WORLD_EXTENT = {
  width: WORLD_TILES.columns * TILE,
  height: WORLD_TILES.rows * TILE,
};

export const CAMERA_MARGIN = 450;

export const SEA_LEVEL = 0.42;

const BEYOND = (0.35 * Math.max(WORLD_EXTENT.width, WORLD_EXTENT.height)) / (MARGIN_TILES * TILE);

export const worldGrid = (spacing = TILE): TileGrid => TileGrid.world(spacing);

export const cellX = (grid: TileGrid, column: number): number => grid.x(column);
export const cellY = (grid: TileGrid, row: number): number => grid.y(row);
export const cellColumn = (grid: TileGrid, x: number): number => grid.column(x);
export const cellRow = (grid: TileGrid, y: number): number => grid.row(y);
export const cellAtPoint = (grid: TileGrid, point: Vec2): number => grid.atPoint(point);

export const OCTAVES = 8;
export const BASE_WAVELENGTH = 108;

const contrast = (value: number, amount = 1.9): number =>
  Math.min(1, Math.max(0, 0.5 + (value - 0.5) * amount));

export function fbm(x: number, y: number, seed: number): number {
  let amplitude = 1;
  let wavelength = BASE_WAVELENGTH;
  let sum = 0;
  let total = 0;

  for (let octave = 0; octave < OCTAVES; octave += 1) {
    sum += amplitude * noise2(x / wavelength, y / wavelength, seed + octave * 7919);
    total += amplitude;
    amplitude *= 0.5;
    wavelength *= 0.5;
  }

  return sum / total;
}

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const COAST_WARP = 0.07;
const COAST_WAVE = 666;

export const NORM = 6;

export function shoreFalloff(x: number, y: number): number {
  const dx = Math.abs(x - WORLD_EXTENT.width / 2) / (WORLD_EXTENT.width / 2);
  const dy = Math.abs(y - WORLD_EXTENT.height / 2) / (WORLD_EXTENT.height / 2);
  const reach = (dx ** NORM + dy ** NORM) ** (1 / NORM);
  const warp = (noise2(x / COAST_WAVE, y / COAST_WAVE, 4441) - 0.5) * 2 * COAST_WARP;

  return smoothstep(0.55, 1.05, reach + warp) * 0.5 + Math.max(0, reach - 1) * BEYOND;
}

export function baseHeight(x: number, y: number, seed: number): number {
  return Math.max(0, contrast(fbm(x, y, seed + 11)) - shoreFalloff(x, y));
}

export function baseHeights(grid: TileGrid, seed: number): Float32Array {
  const heights = new Float32Array(grid.count);

  for (let row = 0; row < grid.rows; row += 1) {
    const y = grid.y(row);
    const at = row * grid.columns;
    for (let column = 0; column < grid.columns; column += 1) {
      heights[at + column] = baseHeight(grid.x(column), y, seed);
    }
  }

  return heights;
}

export function landFraction(seed: number): number {
  const grid = worldGrid();
  const stride = 6;
  let land = 0;
  let total = 0;

  for (let row = 0; row < grid.rows; row += stride) {
    const y = grid.y(row);
    for (let column = 0; column < grid.columns; column += stride) {
      total += 1;
      if (baseHeight(grid.x(column), y, seed) >= SEA_LEVEL) land += 1;
    }
  }

  return land / total;
}
