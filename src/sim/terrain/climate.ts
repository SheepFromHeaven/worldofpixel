import { cellY, SEA_LEVEL, WORLD_EXTENT } from './heightmap.ts';
import type { FieldGrid } from './heightmap.ts';
import { Water } from './hydrology.ts';
import { hashString, prng } from '../rng.ts';
import { Biome } from '../types.ts';

const PEAK_METRES = 2200;

export const altitudeOf = (height: number): number =>
  Math.max(0, (height - SEA_LEVEL) / (1 - SEA_LEVEL));

const HIGHLAND = 0.62;

export interface Latitudes {
  north: number;
  south: number;
}

export function latitudesOf(seed: number): Latitudes {
  const random = prng(hashString(`latitude:${seed}`));
  const north = 16 + random() * 64;
  const span = 22 + random() * 26;
  return { north, south: north - span };
}

const latitudeAt = (latitudes: Latitudes, y: number): number =>
  latitudes.north - (y / WORLD_EXTENT.height) * (latitudes.north - latitudes.south);

const TROPIC = 16;
const TROPICAL_GRADIENT = 0.15;
const EQUATOR_TEMPERATURE = 27;

const POLE_TEMPERATURE = -12;

function seaLevelTemperature(latitude: number): number {
  const absolute = Math.abs(latitude);
  if (absolute <= TROPIC) return EQUATOR_TEMPERATURE - absolute * TROPICAL_GRADIENT;

  const atTropic = EQUATOR_TEMPERATURE - TROPIC * TROPICAL_GRADIENT;
  const gradient = (atTropic - POLE_TEMPERATURE) / (90 - TROPIC);
  return atTropic - (absolute - TROPIC) * gradient;
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

const LATITUDE_RAIN = [4, 2, 2, 2, 1, 1, 2, 2, 2, 2, 3, 3, 2, 2, 1, 1, 1, 0.5];

const PASSABLE = 0.81;

const OROGRAPHIC = 0.625;

const MAX_HUMIDITY = 120;

const SPREAD = 3;

export function precipitation(
  grid: FieldGrid,
  height: Float32Array,
  temperature: Float32Array,
  latitudes: Latitudes,
  seed: number,
): Float32Array {
  const rain = new Float32Array(grid.columns * grid.rows);
  const random = prng(hashString(`wind:${seed}`));

  const middle = (latitudes.north + latitudes.south) / 2;
  const step = Math.abs(middle) > 30 ? 1 : -1;

  const bandRain = (y: number): number => {
    const band = Math.min(LATITUDE_RAIN.length - 1, Math.floor(Math.abs(latitudeAt(latitudes, y)) / 5));
    return LATITUDE_RAIN[band] ?? 1;
  };

  const fall = (humidity: number, here: number, next: number): number => {
    const normal = Math.max(humidity / (10 * SPREAD), 1);
    const climb = Math.max(altitudeOf(height[next]!) - altitudeOf(height[here]!), 0) * 80;
    const slope = (altitudeOf(height[next]!) / OROGRAPHIC) ** 2;
    return Math.min(humidity, Math.max(1, normal + climb * slope));
  };

  const blow = (first: number, onward: number, steps: number, ceiling: number): void => {
    let humidity = ceiling * (1 - altitudeOf(height[first]!));
    if (humidity <= 0) return;

    let here = first;
    for (let s = 0; s < steps - 1; s += 1, here += onward) {
      const next = here + onward;
      if (temperature[here]! < -5) continue;

      if (height[here]! < SEA_LEVEL) {
        if (height[next]! >= SEA_LEVEL) rain[next] = rain[next]! + Math.max(humidity / 15, 1);
        else humidity = Math.min(humidity + 5 * SPREAD, ceiling);
        continue;
      }

      const blocked = altitudeOf(height[next]!) > PASSABLE;
      const fell = blocked ? humidity : fall(humidity, here, next);
      rain[here] = rain[here]! + fell;
      humidity = blocked ? 0 : Math.max(0, humidity - fell + (fell > 1.5 ? 1 : 0));
    }
  };

  for (let row = 0; row < grid.rows; row += 1) {
    const ceiling = MAX_HUMIDITY * bandRain(cellY(grid, row));
    const first = step > 0 ? row * grid.columns : row * grid.columns + grid.columns - 1;
    blow(first, step, grid.columns, ceiling);
  }

  const down = random() < 0.5 ? 1 : -1;
  for (let column = 0; column < grid.columns; column += 1) {
    const ceiling = MAX_HUMIDITY * bandRain(cellY(grid, down > 0 ? 0 : grid.rows - 1)) * 0.34;
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
