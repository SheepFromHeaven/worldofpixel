import type { Vec2 } from '../geometry.ts';
import { MARGIN_TILES, TILE, TileGrid, WORLD_TILES } from '../grid.ts';
import { LatticeNoise } from '../rng.ts';
import { shaped } from './landforms.ts';
import { tectonicsAt } from './plates.ts';

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
const BROAD_OCTAVES = 3;

const contrast = (value: number, amount = 1.9): number =>
  Math.min(1, Math.max(0, 0.5 + (value - 0.5) * amount));

const FINE_AMPLITUDES = Array.from({ length: OCTAVES }, (_, octave) => 0.5 ** octave);
const OCTAVE_NOISE = Array.from({ length: OCTAVES }, () => new LatticeNoise());

let broadFbm = 0;

function fbmPair(x: number, y: number, seed: number, finest: number): number {
  let wavelength = BASE_WAVELENGTH;
  let sum = 0;
  let used = 0;
  let total = 0;
  let broadSum = 0;
  let broadUsed = 0;
  let broadTotal = 0;

  for (let octave = 0; octave < OCTAVES; octave += 1) {
    const amplitude = FINE_AMPLITUDES[octave]!;
    if (wavelength >= finest) {
      sum += amplitude * OCTAVE_NOISE[octave]!.at(x / wavelength, y / wavelength, seed + octave * 7919);
      used += amplitude;
    }
    total += amplitude;
    wavelength *= 0.5;
    if (octave === BROAD_OCTAVES - 1) {
      broadSum = sum;
      broadUsed = used;
      broadTotal = total;
    }
  }

  broadFbm = (broadSum + 0.5 * (broadTotal - broadUsed)) / broadTotal;
  return (sum + 0.5 * (total - used)) / total;
}

export function fbm(x: number, y: number, seed: number, finest = 0, octaves = OCTAVES): number {
  let wavelength = BASE_WAVELENGTH;
  let sum = 0;
  let used = 0;
  let total = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    const amplitude = FINE_AMPLITUDES[octave]!;
    total += amplitude;
    if (wavelength >= finest) {
      sum += amplitude * OCTAVE_NOISE[octave]!.at(x / wavelength, y / wavelength, seed + octave * 7919);
      used += amplitude;
    }
    wavelength *= 0.5;
  }

  return (sum + 0.5 * (total - used)) / total;
}

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const COAST_WARP = 0.07;
const COAST_WAVE = 666;
const COAST_NOISE = new LatticeNoise();

export const NORM = 6;

export function shoreFalloff(x: number, y: number): number {
  const dx = Math.abs(x - WORLD_EXTENT.width / 2) / (WORLD_EXTENT.width / 2);
  const dy = Math.abs(y - WORLD_EXTENT.height / 2) / (WORLD_EXTENT.height / 2);
  const reach = (dx ** NORM + dy ** NORM) ** (1 / NORM);
  const warp = (COAST_NOISE.at(x / COAST_WAVE, y / COAST_WAVE, 4441) - 0.5) * 2 * COAST_WARP;

  return smoothstep(0.55, 1.05, reach + warp) * 0.5 + Math.max(0, reach - 1) * BEYOND;
}

const KNEE = 0.78;

const summit = (height: number): number =>
  height <= KNEE ? height : KNEE + (1 - KNEE) * Math.tanh((height - KNEE) / (1 - KNEE));

export function baseHeight(x: number, y: number, seed: number, finest = 0): number {
  const falloff = shoreFalloff(x, y);
  const inland = 1 - smoothstep(0.08, 0.3, falloff);
  const plates = tectonicsAt(x, y, seed);
  const lift = plates.lift * (1 - smoothstep(0.3, 0.55, falloff));
  const net = contrast(fbmPair(x, y, seed + 11, finest)) - falloff + lift;
  const broad = contrast(broadFbm) - falloff + lift;
  return Math.max(0, summit(shaped(net, broad, SEA_LEVEL, inland, plates.craton, x, y, seed)));
}

export function baseHeights(grid: TileGrid, seed: number): Float32Array {
  const heights = new Float32Array(grid.count);
  const finest = grid.spacing > 1 ? 2 * grid.spacing : 0;

  for (let row = 0; row < grid.rows; row += 1) {
    const y = grid.y(row);
    const at = row * grid.columns;
    for (let column = 0; column < grid.columns; column += 1) {
      heights[at + column] = baseHeight(grid.x(column), y, seed, finest);
    }
  }

  return heights;
}

export function meanHeights(grid: TileGrid, seed: number, across = 4): Float32Array {
  const heights = new Float32Array(grid.count);
  const sub = grid.spacing / across;
  const finest = 2 * sub > 1 ? 2 * sub : 0;

  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      let sum = 0;
      for (let dy = 0; dy < across; dy += 1) {
        for (let dx = 0; dx < across; dx += 1) {
          sum += baseHeight(grid.minX + column * grid.spacing + (dx + 0.5) * sub, grid.minY + row * grid.spacing + (dy + 0.5) * sub, seed, finest);
        }
      }
      heights[row * grid.columns + column] = sum / (across * across);
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
