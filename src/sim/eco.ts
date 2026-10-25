import { noise2 } from './rng.ts';
import { Biome } from './types.ts';
import type { WorldField } from './terrain/worldfield.ts';
import { isWater } from './terrain/worldfield.ts';
import { altitudeOf, PEAK_METRES } from './terrain/climate.ts';

export const ECO_FULL = 255;

const WATER_TABLE_TILES = 9;

const SOIL_WAVE = 38;

const SLOPE_REACH = 16;

const STEEP = 50;

const ROCK_ALTITUDE = 0.55;

const DRY_WET = 4;

const WET_RANGE = 20;

const SQRT2 = Math.SQRT2;

function distanceToFresh(field: WorldField, river: Uint8Array): Float32Array {
  const { grid } = field;
  const { columns, rows } = grid;
  const distance = new Float32Array(grid.count).fill(1e9);

  for (let i = 0; i < grid.count; i += 1) {
    if (river[i] === 1 || field.biome[i] === Biome.Lake) distance[i] = 0;
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const i = row * columns + column;
      let best = distance[i]!;
      if (column > 0) best = Math.min(best, distance[i - 1]! + 1);
      if (row > 0) {
        best = Math.min(best, distance[i - columns]! + 1);
        if (column > 0) best = Math.min(best, distance[i - columns - 1]! + SQRT2);
        if (column < columns - 1) best = Math.min(best, distance[i - columns + 1]! + SQRT2);
      }
      distance[i] = best;
    }
  }

  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      const i = row * columns + column;
      let best = distance[i]!;
      if (column < columns - 1) best = Math.min(best, distance[i + 1]! + 1);
      if (row < rows - 1) {
        best = Math.min(best, distance[i + columns]! + 1);
        if (column < columns - 1) best = Math.min(best, distance[i + columns + 1]! + SQRT2);
        if (column > 0) best = Math.min(best, distance[i + columns - 1]! + SQRT2);
      }
      distance[i] = best;
    }
  }

  return distance;
}

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export const rainScore = (wet: number): number => Math.min(1, Math.max(0, (wet - DRY_WET) / WET_RANGE)) ** 0.6;

export const waterTableScore = (distanceToFresh: number): number => Math.exp(-distanceToFresh / WATER_TABLE_TILES);

export const moistureScore = (wet: number, distanceToFresh: number): number =>
  Math.max(rainScore(wet), waterTableScore(distanceToFresh) * 0.95);

export const slopeScore = (metresPerTile: number): number => 1 - 0.85 * smooth(12, STEEP, metresPerTile);

export const rockScore = (altitude: number): number => 1 - 0.5 * smooth(ROCK_ALTITUDE, 0.8, altitude);

export const ecoScore = (warmth: number, moisture: number, slope: number, rock: number, soil: number): number =>
  Math.min(1, warmth ** 0.6 * moisture ** 0.7 * slope * rock * soil);

export const warmthFor = (celsius: number): number => smooth(-8, 10, celsius) * (1 - smooth(28, 46, celsius));

export function slopeAt(field: WorldField, column: number, row: number): number {
  const { grid, height } = field;
  const left = grid.at(Math.max(column - SLOPE_REACH, 0), row);
  const right = grid.at(Math.min(column + SLOPE_REACH, grid.columns - 1), row);
  const above = grid.at(column, Math.max(row - SLOPE_REACH, 0));
  const below = grid.at(column, Math.min(row + SLOPE_REACH, grid.rows - 1));
  const metres = (i: number): number => altitudeOf(height[i]!) * PEAK_METRES;
  const dx = (metres(right) - metres(left)) / (2 * SLOPE_REACH);
  const dy = (metres(below) - metres(above)) / (2 * SLOPE_REACH);
  return Math.hypot(dx, dy);
}

export interface Ground {
  readonly eco: Uint8Array;
  readonly damp: Uint8Array;
}

export function ecoFor(seed: number, field: WorldField, river: Uint8Array): Ground {
  const { grid } = field;
  const eco = new Uint8Array(grid.count);
  const damp = new Uint8Array(grid.count);
  const fresh = distanceToFresh(field, river);

  for (let row = 0; row < grid.rows; row += 1) {
    const y = grid.y(row);
    const at = row * grid.columns;

    for (let column = 0; column < grid.columns; column += 1) {
      const i = at + column;
      if (isWater(field.biome[i] as Biome) || river[i] === 1) continue;

      damp[i] = Math.round(waterTableScore(fresh[i]!) * ECO_FULL);

      const warmth = warmthFor(field.temperature[i]!);
      if (warmth <= 0) continue;

      const moisture = moistureScore(field.wet[i]!, fresh[i]!);
      const slope = slopeScore(slopeAt(field, column, row));
      const rock = rockScore(altitudeOf(field.height[i]!));
      const soil = 0.7 + 0.3 * noise2(grid.x(column) / SOIL_WAVE, y / SOIL_WAVE, seed + 613);

      const score = ecoScore(warmth, moisture, slope, rock, soil);
      eco[i] = Math.round(score * ECO_FULL);
    }
  }

  return { eco, damp };
}
