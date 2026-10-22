import type { Vec2 } from './geometry.ts';
import { noise2 } from './rng.ts';

export const WORLD_EXTENT = { width: 8000, height: 5600 };

export const WORLD_MARGIN = 1760;

export const SEA_LEVEL = 0.42;

export const FIELD = 1.9;

const SKIRT = 200;

const BEYOND = (0.35 * Math.max(WORLD_EXTENT.width, WORLD_EXTENT.height)) / SKIRT;

export interface FieldGrid {
  columns: number;
  rows: number;
  minX: number;
  minY: number;
  spacing: number;
}

export function worldGrid(spacing = FIELD): FieldGrid {
  return {
    minX: -SKIRT,
    minY: -SKIRT,
    spacing,
    columns: Math.ceil((WORLD_EXTENT.width + SKIRT * 2) / spacing),
    rows: Math.ceil((WORLD_EXTENT.height + SKIRT * 2) / spacing),
  };
}

export const cellX = (grid: FieldGrid, column: number): number =>
  grid.minX + (column + 0.5) * grid.spacing;

export const cellY = (grid: FieldGrid, row: number): number =>
  grid.minY + (row + 0.5) * grid.spacing;

export function cellColumn(grid: FieldGrid, x: number): number {
  const column = Math.floor((x - grid.minX) / grid.spacing);
  return column < 0 ? 0 : column >= grid.columns ? grid.columns - 1 : column;
}

export function cellRow(grid: FieldGrid, y: number): number {
  const row = Math.floor((y - grid.minY) / grid.spacing);
  return row < 0 ? 0 : row >= grid.rows ? grid.rows - 1 : row;
}

export const cellAtPoint = (grid: FieldGrid, point: Vec2): number =>
  cellRow(grid, point.y) * grid.columns + cellColumn(grid, point.x);

const OCTAVES = 9;
const BASE_WAVELENGTH = 420;

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
const COAST_WAVE = 2600;

const NORM = 6;

function shoreFalloff(x: number, y: number): number {
  const dx = Math.abs(x - WORLD_EXTENT.width / 2) / (WORLD_EXTENT.width / 2);
  const dy = Math.abs(y - WORLD_EXTENT.height / 2) / (WORLD_EXTENT.height / 2);
  const reach = (dx ** NORM + dy ** NORM) ** (1 / NORM);
  const warp = (noise2(x / COAST_WAVE, y / COAST_WAVE, 4441) - 0.5) * 2 * COAST_WARP;

  return smoothstep(0.55, 1.05, reach + warp) * 0.5 + Math.max(0, reach - 1) * BEYOND;
}

export function baseHeight(x: number, y: number, seed: number): number {
  return Math.max(0, contrast(fbm(x, y, seed + 11)) - shoreFalloff(x, y));
}

export function baseHeights(grid: FieldGrid, seed: number): Float32Array {
  const heights = new Float32Array(grid.columns * grid.rows);

  for (let row = 0; row < grid.rows; row += 1) {
    const y = cellY(grid, row);
    const at = row * grid.columns;
    for (let column = 0; column < grid.columns; column += 1) {
      heights[at + column] = baseHeight(cellX(grid, column), y, seed);
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
    const y = cellY(grid, row);
    for (let column = 0; column < grid.columns; column += stride) {
      total += 1;
      if (baseHeight(cellX(grid, column), y, seed) >= SEA_LEVEL) land += 1;
    }
  }

  return land / total;
}
