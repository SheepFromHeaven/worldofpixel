import { metresOf, relaxTable, STEP_METRES } from '../geology/geology.ts';
import { TileGrid, WORLD_SIZE_FACTOR } from '../grid.ts';
import type { Latitudes } from './climate.ts';
import { latitudesOf, moisture, precipitation, temperatures } from './climate.ts';
import { baseHeights, meanHeights } from './heightmap.ts';
import type { Flow, Rivers } from './hydrology.ts';
import { accumulate, dryLakes, erodeLakes, resolveFlow, rumpled, traceRivers, Water } from './hydrology.ts';

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
  basin: Uint8Array;
  rivers: Rivers;
  wet: Float32Array;
  head: Float32Array;
  top: number;
}

export const CLIMATE_SPACING = 8 * WORLD_SIZE_FACTOR;

export function buildCoarse(seed: number, spacing: number, climateSpacing = CLIMATE_SPACING): CoarseField {
  const grid = TileGrid.world(spacing);
  const latitudes = latitudesOf(seed);
  const height = baseHeights(grid, seed);
  const flow = resolveFlow(grid, rumpled(grid, height, seed));
  const temperature = temperatures(grid, height, latitudes);
  const climate = TileGrid.world(climateSpacing);
  const climateHeight = meanHeights(climate, seed);
  const climateRain = precipitation(climate, climateHeight, temperatures(climate, climateHeight, latitudes), latitudes, seed);
  const rain = new Float32Array(grid.count);
  for (let row = 0; row < grid.rows; row += 1) for (let column = 0; column < grid.columns; column += 1) rain[row * grid.columns + column] = sampleGrid(climate, climateRain, grid.x(column), grid.y(row));
  const catchment = Float32Array.from(rain, (value) => value * spacing * spacing);

  erodeLakes(grid, flow);
  const basin = Uint8Array.from(flow.water, (water) => (water === Water.Lake ? 1 : 0));
  let flux = accumulate(flow, catchment);
  const evaporation = Float32Array.from(temperature, (value) => value * spacing * spacing);
  for (let round = 0; round < 3; round += 1) {
    if (dryLakes(grid, flow, flux, evaporation) === 0) break;
    flux = accumulate(flow, catchment);
  }

  const rivers = traceRivers(grid, flow, flux, seed);
  const wet = moisture(grid, rain, flow.water, rivers.of, flux);
  const head = waterTable(grid, spacing, height, flow, rivers, wet);
  let high = 0;
  for (const value of height) if (value > high) high = value;
  const top = Math.ceil(metresOf(high) / STEP_METRES) * STEP_METRES;

  return { seed, spacing, grid, height, flow, temperature, rain, flux, latitudes, basin, rivers, wet, head, top };
}

function waterTable(grid: TileGrid, spacing: number, height: Float32Array, flow: Flow, rivers: Rivers, wet: Float32Array): Float32Array {
  const head = new Float32Array(grid.count);
  for (let i = 0; i < grid.count; i += 1) {
    const ground = metresOf(height[i]!);
    let source = Infinity;
    let standing = false;
    if (flow.water[i] === Water.Ocean) {
      source = 0;
      standing = true;
    } else if (flow.water[i] !== Water.None) {
      source = metresOf(flow.filled[i]!);
      standing = true;
    } else if (rivers.of[i] !== 0) source = Math.max(0, ground - 1);
    const arid = Math.round(Math.min(1, Math.max(0, 1 - Math.min(1, Math.max(0, wet[i]! / 22)))) * 255) / 255;
    const dry = Math.max(-20, ground - (4 + 70 * arid));
    head[i] = standing ? source : Math.min(dry, source);
  }
  relaxTable(head, grid.columns, grid.rows, spacing);
  return head;
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
