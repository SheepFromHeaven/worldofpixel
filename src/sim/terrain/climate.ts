import { WORLD_SIZE_FACTOR } from '../grid.ts';
import { hashString, prng } from '../rng.ts';
import { Biome } from '../types.ts';
import type { FieldGrid } from './heightmap.ts';
import { cellY, SEA_LEVEL, WORLD_EXTENT } from './heightmap.ts';
import { Water } from './hydrology.ts';

export const PEAK_METRES = 2200;

export const altitudeOf = (height: number): number =>
  Math.max(0, (height - SEA_LEVEL) / (1 - SEA_LEVEL));

export const HIGHLAND = 0.62;

export interface Latitudes {
  north: number;
  south: number;
}

export function latitudesOf(seed: number): Latitudes {
  const random = prng(hashString(`latitude:${seed}`));
  const north = 66 + random() * 10;
  const south = -(64 + random() * 10);
  return { north, south };
}

export const latitudeAt = (latitudes: Latitudes, y: number): number =>
  latitudes.north - (y / WORLD_EXTENT.height) * (latitudes.north - latitudes.south);

export const MEAN_TEMPERATURE: readonly (readonly [number, number])[] = [
  [0, 27],
  [15, 26],
  [30, 20],
  [45, 9],
  [60, -1],
  [75, -16],
  [90, -25],
];

export function seaLevelTemperature(latitude: number): number {
  const absolute = Math.abs(latitude);
  for (let at = 1; at < MEAN_TEMPERATURE.length; at += 1) {
    const [to, cold] = MEAN_TEMPERATURE[at]!;
    const [from, warm] = MEAN_TEMPERATURE[at - 1]!;
    if (absolute <= to) return warm + ((absolute - from) / (to - from)) * (cold - warm);
  }
  return MEAN_TEMPERATURE[MEAN_TEMPERATURE.length - 1]![1];
}

export function temperatures(
  grid: FieldGrid,
  height: Float32Array,
  latitudes: Latitudes,
): Float32Array {
  const temperature = new Float32Array(grid.columns * grid.rows);

  for (let row = 0; row < grid.rows; row += 1) {
    const atSea = seaLevelTemperature(latitudeAt(latitudes, cellY(grid, row)));
    const at = row * grid.columns;
    for (let column = 0; column < grid.columns; column += 1) {
      const metres = altitudeOf(height[at + column]!) * PEAK_METRES;
      temperature[at + column] = atSea - (metres / 1000) * 6.5;
    }
  }

  return temperature;
}

export const bandStep = (latitude: number): 1 | -1 => {
  const absolute = Math.abs(latitude);
  return absolute < 30 || absolute >= 60 ? -1 : 1;
};

export const zonalFlow = (latitude: number): number => -Math.cos((3 * latitude * Math.PI) / 180);

export const prevailing = (latitudes: Latitudes): 1 | -1 => bandStep((latitudes.north + latitudes.south) / 2);

export const LATITUDE_RAIN = [4, 2, 2, 2, 1, 1, 2, 2, 2, 2, 3, 3, 2, 2, 1, 1, 1, 0.5];

export const PASSABLE = 0.81;

const OROGRAPHIC = 0.625;

const MAX_HUMIDITY = 142;

const SPREAD = 3;

const FALLOUT_LENGTH = 10 * SPREAD;
const FALLOUT_FLOOR = 1;
const SEA_RECHARGE = 5 * SPREAD;
const COAST_SHARE = 1 / 15;
const LIFT = 80;
const COLD_AIR = -5;
const RECYCLE = 0.55;

export interface Fallout {
  rain: number;
  left: number;
}

const fallout = (humidity: number, length: number, lift: number, reach: number): Fallout => {
  const stop = reach * FALLOUT_LENGTH * FALLOUT_FLOOR;
  const span = (reach * FALLOUT_LENGTH) / (1 - RECYCLE);
  const gain = 1 / (1 - RECYCLE);
  let rain = 0;
  let left = humidity;
  let remaining = length;

  if (left > stop) {
    const lifted = reach * FALLOUT_LENGTH * lift;
    const spent = span * Math.log((left + lifted) / (stop + lifted));
    if (length <= spent) {
      const after = (left + lifted) * Math.exp(-length / span) - lifted;
      return { rain: (left - after) * gain, left: after };
    }
    rain += (left - stop) * gain;
    left = stop;
    remaining = length - spent;
  }

  const taken = Math.min(left, (FALLOUT_FLOOR + lift) * remaining);
  return { rain: rain + taken, left: left - taken };
};

export function precipitation(
  grid: FieldGrid,
  height: Float32Array,
  temperature: Float32Array,
  latitudes: Latitudes,
  seed: number,
): Float32Array {
  const rain = new Float32Array(grid.columns * grid.rows);
  const random = prng(hashString(`wind:${seed}`));
  const reach = WORLD_SIZE_FACTOR;
  const step = grid.spacing;

  const bandRain = (y: number): number => {
    const band = Math.min(LATITUDE_RAIN.length - 1, Math.floor(Math.abs(latitudeAt(latitudes, y)) / 5));
    return LATITUDE_RAIN[band] ?? 1;
  };

  const blow = (first: number, onward: number, steps: number, ceiling: number): void => {
    let humidity = ceiling * (1 - altitudeOf(height[first]!));
    if (humidity <= 0) return;

    let strip = 0;
    let stripRate = 0;
    let here = first;
    for (let s = 0; s < steps - 1; s += 1, here += onward) {
      const next = here + onward;
      if (temperature[here]! < COLD_AIR) continue;

      if (height[here]! < SEA_LEVEL) {
        if (height[next]! >= SEA_LEVEL) {
          const spray = Math.max(humidity * COAST_SHARE, FALLOUT_FLOOR);
          strip = reach;
          stripRate = spray / reach;
        } else humidity = Math.min(humidity + SEA_RECHARGE * step, ceiling);
        continue;
      }

      const blocked = altitudeOf(height[next]!) > PASSABLE;
      if (blocked) {
        rain[here] = rain[here]! + humidity / Math.max(step, reach);
        humidity = 0;
        continue;
      }

      const climb = (Math.max(altitudeOf(height[next]!) - altitudeOf(height[here]!), 0) * LIFT) / step;
      const lift = climb * (altitudeOf(height[next]!) / OROGRAPHIC) ** 2;
      const shed = fallout(humidity, step, lift, reach);
      rain[here] = rain[here]! + shed.rain / step;
      humidity = shed.left;

      if (strip > 0) {
        const covered = Math.min(step, strip);
        rain[here] = rain[here]! + (covered * stripRate) / step;
        strip -= covered;
      }
    }
  };

  for (let row = 0; row < grid.rows; row += 1) {
    const ceiling = MAX_HUMIDITY * reach * bandRain(cellY(grid, row));
    const direction = bandStep(latitudeAt(latitudes, cellY(grid, row)));
    const first = direction > 0 ? row * grid.columns : row * grid.columns + grid.columns - 1;
    blow(first, direction, grid.columns, ceiling);
  }

  const down = random() < 0.5 ? 1 : -1;
  for (let column = 0; column < grid.columns; column += 1) {
    const ceiling = MAX_HUMIDITY * reach * bandRain(cellY(grid, down > 0 ? 0 : grid.rows - 1)) * 0.34;
    const first = down > 0 ? column : (grid.rows - 1) * grid.columns + column;
    blow(first, down * grid.columns, grid.rows, ceiling);
  }

  for (let cell = 0; cell < rain.length; cell += 1) rain[cell] = rain[cell]! * SPREAD;

  return rain;
}

export function moisture(
  grid: FieldGrid,
  rain: Float32Array,
  water: Uint8Array,
  river: Int32Array,
  flux: Float32Array,
): Float32Array {
  const count = grid.columns * grid.rows;
  const wet = new Float32Array(count);

  for (let cell = 0; cell < count; cell += 1) {
    if (water[cell] !== Water.None) continue;

    let sum = rain[cell]! + (river[cell] !== 0 ? Math.max(flux[cell]! / 400, 2) : 0);
    let counted = 1;

    const column = cell % grid.columns;
    const row = (cell - column) / grid.columns;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const c = column + dx;
        const r = row + dy;
        if (c < 0 || c >= grid.columns || r < 0 || r >= grid.rows) continue;
        const near = r * grid.columns + c;
        sum += water[near] === Water.None ? rain[near]! : 30;
        counted += 1;
      }
    }

    wet[cell] = 4 + sum / counted;
  }

  return wet;
}

const MATRIX: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10],
  [3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 9, 9, 9, 9, 10, 10, 10],
  [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 9, 9, 9, 9, 9, 10, 10, 10],
  [5, 6, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 10, 10, 10],
  [7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 10, 10],
];

const AS: readonly Biome[] = [
  Biome.Ocean,
  Biome.Desert,
  Biome.Desert,
  Biome.Meadow,
  Biome.Meadow,
  Biome.Forest,
  Biome.Forest,
  Biome.Forest,
  Biome.Forest,
  Biome.Forest,
  Biome.Tundra,
];

function waterlogged(wet: number, temperature: number, altitude: number): boolean {
  if (temperature <= -2) return false;
  if (wet > 40 && altitude < 0.06) return true;
  return wet > 24 && altitude > 0.05 && altitude < 0.5;
}

export function classify(
  height: number,
  temperature: number,
  wet: number,
  onRiver: boolean,
): Biome {
  const altitude = altitudeOf(height);

  if (altitude > HIGHLAND) return Biome.Highland;
  if (temperature < -5) return Biome.Tundra;
  if (temperature >= 25 && !onRiver && wet < 8) return Biome.Desert;
  if (waterlogged(wet, temperature, altitude)) return Biome.Marsh;

  const wetBand = Math.min(Math.floor(wet / 5), 4);
  const coldBand = Math.min(Math.max(20 - Math.round(temperature), 0), 25);
  return AS[MATRIX[wetBand]![coldBand]!] ?? Biome.Meadow;
}
