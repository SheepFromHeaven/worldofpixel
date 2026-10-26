import { COARSE } from '../../src/sim/geology/geology.ts';
import { FEATURES } from '../../src/sim/geology/minerals.ts';
import { TileGrid } from '../../src/sim/grid.ts';
import { precipitation, temperatures } from '../../src/sim/terrain/climate.ts';
import { buildCoarse } from '../../src/sim/terrain/coarse.ts';
import { baseHeights } from '../../src/sim/terrain/heightmap.ts';
import { Water } from '../../src/sim/terrain/hydrology.ts';
import type { FineWindow } from '../../src/sim/terrain/window.ts';
import { buildWindow, windowIndex } from '../../src/sim/terrain/window.ts';
import { truthFrom } from '../windowTruth.ts';
import { SEED } from './context.ts';

export const SPACING = 8;
export const SIZE = 256;
export const HALO = 32;
export const PATCH = 3;

export interface Patch {
  columns: number;
  rows: number;
  truthBiome: Uint8Array;
  windowBiome: Uint8Array;
  height: Float32Array;
  x0: number;
  y0: number;
}

export interface WindowRun {
  windows: number;
  msPerWindow: number;
  coarseMs: number;
  truthSeconds: number;
  coarseCells: number;
  climateCorrelation: number;
  water: number;
  lakeWindows: number;
  lakeWhole: number;
  riverRecall: number;
  riverPrecision: number;
  climate: number;
  biome: number;
  fertilityOff: number;
  cells: number;
  series: number;
  rock: number;
  soilOff: number;
  featuresOff: number;
  tableMedian: number;
  tableP90: number;
  coarseHeight: Float32Array;
  coarseWater: Uint8Array;
  coarseColumns: number;
  coarseRows: number;
  patch: Patch;
}

let cached: WindowRun | null = null;

export function windowRun(): WindowRun {
  if (cached) return cached;
  let t = performance.now();
  const coarse = buildCoarse(SEED, SPACING);
  const coarseMs = performance.now() - t;
  t = performance.now();
  const truth = truthFrom(coarse, null, SEED);
  const truthSeconds = (performance.now() - t) / 1000;
  const fine = TileGrid.world(1);
  const plain = baseHeights(fine, SEED);
  const rainFine = precipitation(fine, plain, temperatures(fine, plain, coarse.latitudes), coarse.latitudes, SEED);
  let cn = 0;
  let cx = 0;
  let cy = 0;
  let cxx = 0;
  let cyy = 0;
  let cxy = 0;
  for (let row = 0; row < coarse.grid.rows; row += 1) {
    for (let column = 0; column < coarse.grid.columns; column += 1) {
      let pooled = 0;
      let count = 0;
      for (let dy = 0; dy < SPACING && row * SPACING + dy < fine.rows; dy += 1) for (let dx = 0; dx < SPACING && column * SPACING + dx < fine.columns; dx += 1) {
        pooled += rainFine[(row * SPACING + dy) * fine.columns + column * SPACING + dx]!;
        count += 1;
      }
      const a = pooled / count;
      const b = coarse.rain[row * coarse.grid.columns + column]!;
      if (coarse.flow.water[row * coarse.grid.columns + column] === Water.Ocean) continue;
      cn += 1; cx += a; cy += b; cxx += a * a; cyy += b * b; cxy += a * b;
    }
  }
  const climateCorrelation = (cn * cxy - cx * cy) / Math.sqrt((cn * cxx - cx * cx) * (cn * cyy - cy * cy));

  const positions: [number, number][] = [];
  for (let row = 96; row + SIZE <= fine.rows - 96; row += SIZE) for (let column = 96; column + SIZE <= fine.columns - 96; column += SIZE) positions.push([column, row]);
  const picked = positions.filter((_, i) => i % 2 === 0);

  const sum = { ms: 0, tiles: 0, water: 0, land: 0, lakeWindow: 0, lakeWhole: 0, climate: 0, biome: 0, fertility: 0, riverTruth: 0, riverWindow: 0, recall: 0, precision: 0, cells: 0, series: 0, rock: 0, soil: 0, features: 0 };
  const heads: number[] = [];
  const reach = (mask: (index: number) => boolean, at: (dx: number, dy: number) => number): boolean => {
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (mask(at(dx, dy))) return true;
    return false;
  };

  for (const [column0, row0] of picked) {
    const started = performance.now();
    const win = buildWindow(coarse, null, column0, row0, SIZE, SIZE, { halo: HALO });
    sum.ms += performance.now() - started;
    for (let row = row0; row < row0 + SIZE; row += 1) {
      for (let column = column0; column < column0 + SIZE; column += 1) {
        const di = row * fine.columns + column;
        const wi = windowIndex(win, column, row);
        sum.tiles += 1;
        if (truth.water[di] === win.water[wi]) sum.water += 1;
        if (truth.water[di] !== Water.Ocean) sum.land += 1;
        if (truth.water[di] === Water.Lake) sum.lakeWhole += 1;
        if (win.water[wi] === Water.Lake) sum.lakeWindow += 1;
        if (truth.climate[di] === win.climate[wi]) sum.climate += 1;
        if (truth.biome[di] === win.biome[wi]) sum.biome += 1;
        sum.fertility += Math.abs(truth.fertility![di]! - win.fertility[wi]!);
        const dr = truth.river[di] === 1;
        const wr = win.rivers.of[wi] !== 0;
        if (dr) {
          sum.riverTruth += 1;
          if (reach((i) => win.rivers.of[i] !== 0, (dx, dy) => wi + dy * win.grid.columns + dx)) sum.recall += 1;
        }
        if (wr) {
          sum.riverWindow += 1;
          if (reach((i) => truth.river[i] === 1, (dx, dy) => di + dy * fine.columns + dx)) sum.precision += 1;
        }
      }
    }
    const mine = win.geology.coarseFields();
    const theirs = truth.geology!.coarseFields();
    const first = { column: column0 - HALO, row: row0 - HALO };
    for (let cr = HALO / COARSE; cr < (HALO + SIZE) / COARSE; cr += 1) {
      for (let cc = HALO / COARSE; cc < (HALO + SIZE) / COARSE; cc += 1) {
        const a = cr * mine.columns + cc;
        const b = ((first.row + cr * COARSE) / COARSE) * theirs.columns + (first.column + cc * COARSE) / COARSE;
        sum.cells += 1;
        if (mine.series[a] === theirs.series[b]) sum.series += 1;
        if (mine.surfaceRock[a] === theirs.surfaceRock[b]) sum.rock += 1;
        sum.soil += Math.abs(mine.soil[a]! - theirs.soil[b]!);
        for (let k = 0; k < FEATURES.length; k += 1) sum.features += Math.abs(mine.features[a * FEATURES.length + k]! - theirs.features[b * FEATURES.length + k]!);
        const x = win.grid.x(cc * COARSE + COARSE / 2);
        const y = win.grid.y(cr * COARSE + COARSE / 2);
        heads.push(Math.abs(win.geology.tableAt(x, y) - truth.geology!.tableAt(x, y)));
      }
    }
  }
  heads.sort((a, b) => a - b);

  const span = SIZE * PATCH;
  const [x0, y0] = [1312, 608];
  const patch: Patch = { columns: span, rows: span, truthBiome: new Uint8Array(span * span), windowBiome: new Uint8Array(span * span), height: new Float32Array(span * span), x0, y0 };
  for (let wy = 0; wy < PATCH; wy += 1) {
    for (let wx = 0; wx < PATCH; wx += 1) {
      const win: FineWindow = buildWindow(coarse, null, x0 + wx * SIZE, y0 + wy * SIZE, SIZE, SIZE, { halo: HALO });
      for (let row = 0; row < SIZE; row += 1) {
        for (let column = 0; column < SIZE; column += 1) {
          const at = (wy * SIZE + row) * span + wx * SIZE + column;
          const di = (y0 + wy * SIZE + row) * fine.columns + x0 + wx * SIZE + column;
          const wi = windowIndex(win, x0 + wx * SIZE + column, y0 + wy * SIZE + row);
          patch.windowBiome[at] = win.biome[wi]!;
          patch.height[at] = win.terrain[wi]!;
          patch.truthBiome[at] = truth.biome[di]!;
        }
      }
    }
  }

  cached = {
    windows: picked.length,
    msPerWindow: sum.ms / picked.length,
    coarseMs,
    truthSeconds,
    coarseCells: coarse.grid.count,
    climateCorrelation,
    water: (100 * sum.water) / sum.tiles,
    lakeWindows: (100 * sum.lakeWindow) / Math.max(1, sum.land),
    lakeWhole: (100 * sum.lakeWhole) / Math.max(1, sum.land),
    riverRecall: (100 * sum.recall) / Math.max(1, sum.riverTruth),
    riverPrecision: (100 * sum.precision) / Math.max(1, sum.riverWindow),
    climate: (100 * sum.climate) / sum.tiles,
    biome: (100 * sum.biome) / sum.tiles,
    fertilityOff: sum.fertility / sum.tiles,
    cells: sum.cells,
    series: (100 * sum.series) / sum.cells,
    rock: (100 * sum.rock) / sum.cells,
    soilOff: sum.soil / sum.cells,
    featuresOff: sum.features / (sum.cells * FEATURES.length),
    tableMedian: heads[Math.floor(heads.length / 2)]!,
    tableP90: heads[Math.floor(heads.length * 0.9)]!,
    coarseHeight: coarse.height,
    coarseWater: coarse.flow.water,
    coarseColumns: coarse.grid.columns,
    coarseRows: coarse.grid.rows,
    patch,
  };
  return cached;
}
