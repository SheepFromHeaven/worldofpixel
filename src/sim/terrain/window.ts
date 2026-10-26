import { MARGIN_TILES, TileGrid } from '../grid.ts';
import { moisture, temperatures } from './climate.ts';
import type { CoarseField } from './coarse.ts';
import { sampleCoarse } from './coarse.ts';
import { baseHeights, SEA_LEVEL } from './heightmap.ts';
import type { Rivers } from './hydrology.ts';
import { accumulate, dryLakes, resolveFlow, rumpled, traceRivers, Water } from './hydrology.ts';
import type { RiverNetwork } from './riverNetwork.ts';
import { carveRivers, lendFlux } from './riverNetwork.ts';
import { classifyAll, wanderEdges } from './worldfield.ts';

export interface WindowOptions {
  halo: number;
}

export const DEFAULT_WINDOW: WindowOptions = { halo: 32 };

export interface FineWindow {
  grid: TileGrid;
  halo: number;
  column0: number;
  row0: number;
  width: number;
  height: number;
  terrain: Float32Array;
  water: Uint8Array;
  flux: Float32Array;
  rivers: Rivers;
  temperature: Float32Array;
  wet: Float32Array;
  biome: Uint8Array;
}

export function windowIndex(window: FineWindow, column: number, row: number): number {
  return (row - window.row0 + window.halo) * window.grid.columns + (column - window.column0 + window.halo);
}

export function coarseOcean(coarse: CoarseField, grid: TileGrid, routing: Float32Array, first: { column: number; row: number }): Uint8Array {
  const sea = new Uint8Array(grid.count);
  const { spacing } = coarse;
  const { columns: across, rows: down } = coarse.grid;
  for (let row = 0; row < grid.rows; row += 1) {
    const cr = Math.floor((row + first.row) / spacing);
    for (let column = 0; column < grid.columns; column += 1) {
      const i = row * grid.columns + column;
      if (routing[i]! >= SEA_LEVEL) continue;
      const cc = Math.floor((column + first.column) / spacing);
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const c = Math.min(across - 1, Math.max(0, cc + dx));
          const r = Math.min(down - 1, Math.max(0, cr + dy));
          if (coarse.flow.water[r * across + c] === Water.Ocean) {
            near = true;
            break;
          }
        }
      }
      if (near) sea[i] = Water.Ocean;
    }
  }
  return sea;
}

export function rainOver(coarse: CoarseField, grid: TileGrid): Float32Array {
  const rain = new Float32Array(grid.count);
  for (let row = 0; row < grid.rows; row += 1) {
    const y = grid.y(row);
    for (let column = 0; column < grid.columns; column += 1) rain[row * grid.columns + column] = sampleCoarse(coarse, coarse.rain, grid.x(column), y);
  }
  return rain;
}

export function buildWindow(coarse: CoarseField, network: RiverNetwork | null, column0: number, row0: number, width: number, height: number, options: WindowOptions = DEFAULT_WINDOW): FineWindow {
  const { halo } = options;
  const first = { column: column0 - halo, row: row0 - halo };
  const columns = width + 2 * halo;
  const rows = height + 2 * halo;
  const grid = new TileGrid(columns, rows, -MARGIN_TILES + first.column, -MARGIN_TILES + first.row, 1);
  const { seed, flow: coarseFlow } = coarse;
  const terrain = baseHeights(grid, seed);
  const sea = coarseOcean(coarse, grid, rumpled(grid, terrain, seed, first), first);
  if (network) carveRivers(network, grid, terrain);
  const routing = rumpled(grid, terrain, seed, first);

  const level = new Float32Array(grid.count).fill(NaN);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (row !== 0 && row !== rows - 1 && column !== 0 && column !== columns - 1) continue;
      const i = row * columns + column;
      if (sea[i] === Water.Ocean) continue;
      const j = Math.min(coarse.grid.rows - 1, Math.max(0, Math.floor((row + first.row) / coarse.spacing))) * coarse.grid.columns + Math.min(coarse.grid.columns - 1, Math.max(0, Math.floor((column + first.column) / coarse.spacing)));
      level[i] = coarseFlow.water[j] === Water.Lake ? Math.max(routing[i]!, coarseFlow.filled[j]!) : routing[i]!;
    }
  }

  const flow = resolveFlow(grid, routing, { ocean: sea, level });
  const temperature = temperatures(grid, terrain, coarse.latitudes);
  const rain = rainOver(coarse, grid);

  let flux = accumulate(flow, rain);
  for (let round = 0; round < 3; round += 1) {
    if (dryLakes(grid, flow, flux, temperature) === 0) break;
    flux = accumulate(flow, rain);
  }
  if (network) lendFlux(network, grid, flux);

  const rivers = traceRivers(grid, flow, flux, seed);
  const wet = moisture(grid, rain, flow.water, rivers.of, flux);
  const classed = classifyAll(grid, flow.water, terrain, temperature, wet, rivers.of);
  const biome = wanderEdges(grid, classed, seed);

  return { grid, halo, column0, row0, width, height, terrain, water: flow.water, flux, rivers, temperature, wet, biome };
}
