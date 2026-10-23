import type { Latitudes } from './climate.ts';
import { altitudeOf, bandStep, latitudeAt } from './climate.ts';
import type { FieldGrid } from './heightmap.ts';
import { cellY } from './heightmap.ts';
import { Water } from './hydrology.ts';

const RAVINE_REACH = 9;
const OPEN_REACH = 10;
const LEE_REACH = 14;
const LEE_SPAN = 6;

const BASE = 0.36;
const BELTS = 0.12;
const EXPOSURE = 0.4;
const CHANNEL = 0.5;
const FETCH = 0.16;
const DEPTH = 22;
const SHADOW = 12;
const SHADOW_CEILING = 0.45;
const RAVINE_FLOOR = 0.01;

function blur(source: Float32Array, columns: number, rows: number, radius: number): Float32Array {
  const across = new Float32Array(source.length);
  const out = new Float32Array(source.length);
  const width = radius * 2 + 1;

  for (let row = 0; row < rows; row += 1) {
    const at = row * columns;
    let sum = 0;
    for (let k = -radius; k <= radius; k += 1) sum += source[at + Math.min(columns - 1, Math.max(0, k))]!;
    for (let column = 0; column < columns; column += 1) {
      across[at + column] = sum / width;
      sum += source[at + Math.min(columns - 1, column + radius + 1)]!;
      sum -= source[at + Math.max(0, column - radius)]!;
    }
  }

  for (let column = 0; column < columns; column += 1) {
    let sum = 0;
    for (let k = -radius; k <= radius; k += 1) sum += across[Math.min(rows - 1, Math.max(0, k)) * columns + column]!;
    for (let row = 0; row < rows; row += 1) {
      out[row * columns + column] = sum / width;
      sum += across[Math.min(rows - 1, row + radius + 1) * columns + column]!;
      sum -= across[Math.max(0, row - radius) * columns + column]!;
    }
  }

  return out;
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

export function winds(
  grid: FieldGrid,
  height: Float32Array,
  water: Uint8Array,
  latitudes: Latitudes,
): Uint8Array {
  const { columns, rows } = grid;
  const wet = new Float32Array(columns * rows);
  for (let cell = 0; cell < wet.length; cell += 1) wet[cell] = water[cell] === Water.None ? 0 : 1;

  const around = blur(height, columns, rows, RAVINE_REACH);
  const open = blur(wet, columns, rows, OPEN_REACH);
  const ridges = blur(height, columns, rows, LEE_SPAN);

  const out = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row += 1) {
    const degrees = latitudeAt(latitudes, cellY(grid, row));
    const latitude = (degrees * Math.PI) / 180;
    const step = bandStep(degrees);
    const belt = BASE + BELTS * Math.sin(latitude * 3);

    for (let column = 0; column < columns; column += 1) {
      const cell = row * columns + column;
      const here = height[cell]!;
      const upwind = ridges[row * columns + clamp(column - step * LEE_REACH, 0, columns - 1)]!;

      const exposure = altitudeOf(here) * EXPOSURE;
      const channel = wet[cell] === 1 ? 0 : clamp((around[cell]! - here - RAVINE_FLOOR) * DEPTH, 0, 1) * CHANNEL;
      const fetch = open[cell]! * FETCH;
      const shelter = clamp((upwind - here) * SHADOW, 0, SHADOW_CEILING);

      out[cell] = Math.round(clamp((belt + exposure + channel + fetch) * (1 - shelter), 0, 1) * 255);
    }
  }

  return out;
}

const CALM = 0.28;
const BREEZY = 0.45;
const WINDY = 0.62;

export function windName(wind: number): string {
  const value = wind / 255;
  if (value < CALM) return 'still air';
  if (value < BREEZY) return 'a breeze';
  if (value < WINDY) return 'windy';
  return 'wind-scoured';
}
