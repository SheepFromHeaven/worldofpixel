import { TileGrid } from '../grid.ts';
import type { Latitudes } from './climate.ts';
import { latitudesOf, precipitation, temperatures } from './climate.ts';
import { baseHeights } from './heightmap.ts';
import type { Flow } from './hydrology.ts';
import { accumulate, dryLakes, resolveFlow, rumpled } from './hydrology.ts';

export interface CoarseField {
  seed: number;
  spacing: number;
  grid: TileGrid;
  height: Float32Array;
  flow: Flow;
  temperature: Float32Array;
  rain: Float32Array;
  flux: Float32Array;
  latitudes: Latitudes;
}

export function buildCoarse(seed: number, spacing: number, climateSpacing = spacing): CoarseField {
  const grid = TileGrid.world(spacing);
  const latitudes = latitudesOf(seed);
  const height = baseHeights(grid, seed);
  const flow = resolveFlow(grid, rumpled(grid, height, seed));
  const temperature = temperatures(grid, height, latitudes);
  let rain: Float32Array;
  if (climateSpacing !== spacing) {
    const climate = TileGrid.world(climateSpacing);
    const climateHeight = baseHeights(climate, seed);
    const climateRain = precipitation(climate, climateHeight, temperatures(climate, climateHeight, latitudes), latitudes, seed);
    rain = new Float32Array(grid.count);
    for (let row = 0; row < grid.rows; row += 1) for (let column = 0; column < grid.columns; column += 1) rain[row * grid.columns + column] = sampleGrid(climate, climateRain, grid.x(column), grid.y(row));
  } else rain = precipitation(grid, height, temperature, latitudes, seed);
  const catchment = Float32Array.from(rain, (value) => value * spacing * spacing);

  let flux = accumulate(flow, catchment);
  for (let round = 0; round < 3; round += 1) {
    if (dryLakes(grid, flow, flux, temperature) === 0) break;
    flux = accumulate(flow, catchment);
  }

  return { seed, spacing, grid, height, flow, temperature, rain, flux, latitudes };
}

export function sampleCoarse(coarse: CoarseField, source: Float32Array, x: number, y: number): number {
  return sampleGrid(coarse.grid, source, x, y);
}

export function sampleGrid(grid: TileGrid, source: Float32Array, x: number, y: number): number {
  const fx = (x - grid.minX) / grid.spacing - 0.5;
  const fy = (y - grid.minY) / grid.spacing - 0.5;
  const c0 = Math.min(grid.columns - 1, Math.max(0, Math.floor(fx)));
  const r0 = Math.min(grid.rows - 1, Math.max(0, Math.floor(fy)));
  const c1 = Math.min(grid.columns - 1, c0 + 1);
  const r1 = Math.min(grid.rows - 1, r0 + 1);
  const u = Math.min(1, Math.max(0, fx - c0));
  const v = Math.min(1, Math.max(0, fy - r0));
  const top = source[r0 * grid.columns + c0]! * (1 - u) + source[r0 * grid.columns + c1]! * u;
  const bottom = source[r1 * grid.columns + c0]! * (1 - u) + source[r1 * grid.columns + c1]! * u;
  return top * (1 - v) + bottom * v;
}
