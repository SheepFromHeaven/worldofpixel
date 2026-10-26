import { Geology } from '../geology/geology.ts';
import { MARGIN_TILES, TileGrid } from '../grid.ts';
import { moisture, temperatures } from './climate.ts';
import type { CoarseField } from './coarse.ts';
import { sampleCoarse, sampleGrid } from './coarse.ts';
import { baseHeights, SEA_LEVEL } from './heightmap.ts';
import type { Flow, Rivers } from './hydrology.ts';
import { accumulate, dryLakes, resolveFlow, rumpled, traceRivers, Water } from './hydrology.ts';
import type { RiverNetwork } from './riverNetwork.ts';
import { carveRivers, lendFlux } from './riverNetwork.ts';
import { surfaceBiomes } from './surface.ts';
import { classifyAll, riverTiles, wanderEdges } from './worldfield.ts';

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
  surface: Float32Array;
  temperature: Float32Array;
  wet: Float32Array;
  climate: Uint8Array;
  biome: Uint8Array;
  fertility: Uint8Array;
  geology: Geology;
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

export function clipCoarseLakes(coarse: CoarseField, grid: TileGrid, flow: Flow, first: { column: number; row: number }): Uint8Array {
  const pinned = new Uint8Array(grid.count);
  const { spacing } = coarse;
  const { columns: across, rows: down } = coarse.grid;
  const coarseAt = (column: number, row: number): number =>
    Math.min(down - 1, Math.max(0, Math.floor((row + first.row) / spacing))) * across + Math.min(across - 1, Math.max(0, Math.floor((column + first.column) / spacing)));
  const surfaceAt = (column: number, row: number): number => {
    const fx = (column + first.column + 0.5) / spacing - 0.5;
    const fy = (row + first.row + 0.5) / spacing - 0.5;
    const c0 = Math.min(across - 1, Math.max(0, Math.floor(fx)));
    const r0 = Math.min(down - 1, Math.max(0, Math.floor(fy)));
    const c1 = Math.min(across - 1, c0 + 1);
    const r1 = Math.min(down - 1, r0 + 1);
    const u = Math.min(1, Math.max(0, fx - c0));
    const v = Math.min(1, Math.max(0, fy - r0));
    const level = (c: number, r: number): number => {
      const j = r * across + c;
      return coarse.flow.water[j] === Water.Lake ? coarse.flow.filled[j]! : coarse.flow.ground[j]! - 0.1;
    };
    const top = level(c0, r0) * (1 - u) + level(c1, r0) * u;
    const bottom = level(c0, r1) * (1 - u) + level(c1, r1) * u;
    return top * (1 - v) + bottom * v;
  };
  const poolAt = (column: number, row: number): number => {
    const fx = (column + first.column + 0.5) / spacing - 0.5;
    const fy = (row + first.row + 0.5) / spacing - 0.5;
    const c0 = Math.min(across - 1, Math.max(0, Math.floor(fx)));
    const r0 = Math.min(down - 1, Math.max(0, Math.floor(fy)));
    let pool = 0;
    for (const [c, r] of [[c0, r0], [Math.min(across - 1, c0 + 1), r0], [c0, Math.min(down - 1, r0 + 1)], [Math.min(across - 1, c0 + 1), Math.min(down - 1, r0 + 1)]] as const) {
      const j = r * across + c;
      if (coarse.flow.water[j] === Water.Lake && coarse.flow.filled[j]! > pool) pool = coarse.flow.filled[j]!;
    }
    return pool;
  };
  const seen = new Uint8Array(grid.count);
  const body = new Int32Array(grid.count);

  for (let start = 0; start < grid.count; start += 1) {
    if (flow.water[start] !== Water.Lake || seen[start] === 1) continue;
    let head = 0;
    let tail = 0;
    let broad = false;
    body[tail] = start;
    tail += 1;
    seen[start] = 1;

    while (head < tail) {
      const cell = body[head]!;
      head += 1;
      const column = cell % grid.columns;
      const row = (cell - column) / grid.columns;
      if (coarse.basin[coarseAt(column, row)] === 1) broad = true;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const c = column + dx;
          const r = row + dy;
          if (c < 0 || c >= grid.columns || r < 0 || r >= grid.rows) continue;
          const next = r * grid.columns + c;
          if (flow.water[next] !== Water.Lake || seen[next] === 1) continue;
          seen[next] = 1;
          body[tail] = next;
          tail += 1;
        }
      }
    }
    if (!broad) continue;

    for (let i = 0; i < tail; i += 1) {
      const cell = body[i]!;
      const column = cell % grid.columns;
      const row = (cell - column) / grid.columns;
      const pool = poolAt(column, row);
      if (pool > 0 && flow.ground[cell]! <= surfaceAt(column, row)) {
        flow.filled[cell] = Math.max(pool, flow.ground[cell]!);
        pinned[cell] = 1;
      } else {
        flow.water[cell] = Water.None;
        flow.sink[cell] = 1;
      }
    }
  }
  return pinned;
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
      level[i] = Math.max(SEA_LEVEL, coarseFlow.water[j] === Water.Lake ? Math.max(routing[i]!, coarseFlow.filled[j]!) : routing[i]!);
    }
  }

  const flow = resolveFlow(grid, routing, { ocean: sea, level });
  const temperature = temperatures(grid, terrain, coarse.latitudes);
  const rain = rainOver(coarse, grid);

  const pinned = clipCoarseLakes(coarse, grid, flow, first);
  let flux = accumulate(flow, rain);
  for (let round = 0; round < 3; round += 1) {
    if (dryLakes(grid, flow, flux, temperature, pinned) === 0) break;
    flux = accumulate(flow, rain);
  }
  if (network) lendFlux(network, grid, flux);

  const rivers = traceRivers(grid, flow, flux, seed);
  const wet = moisture(grid, rain, flow.water, rivers.of, flux);
  const classed = classifyAll(grid, flow.water, terrain, temperature, wet, rivers.of);
  const climate = wanderEdges(grid, classed, seed);

  const river = riverTiles({ grid, rivers });
  const geology = new Geology(
    { seed, grid, field: { height: terrain, wet, temperature, climate, water: flow.water, surface: flow.filled }, river },
    { top: coarse.top, floor: (x, y) => sampleGrid(coarse.grid, coarse.head, x, y) },
  );
  const { biome, fertility } = surfaceBiomes({ seed, grid, climate, height: terrain }, geology, river);

  return { grid, halo, column0, row0, width, height, terrain, water: flow.water, flux, rivers, surface: flow.filled, temperature, wet, climate, biome, fertility, geology };
}
