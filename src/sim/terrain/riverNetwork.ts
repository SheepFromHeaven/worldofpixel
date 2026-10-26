import type { TileGrid } from '../grid.ts';
import { noise2 } from '../rng.ts';
import type { CoarseField } from './coarse.ts';
import { baseHeight } from './heightmap.ts';
import { RIVER_FLUX, Water } from './hydrology.ts';

export const BIG_RIVER_FLUX = 8000;
export const BANK_SLOPE = 0.003;
export const BANK_REACH_TILES = 10;
export const BED_FALL = 1e-6;
export const BED_FINEST = 16;

const NARROWEST = 0.5;
const WIDEST = 3.4;
const LATERAL_WAVE = 18;
const LATERAL_REACH = 3;
const BUCKET_TILES = 16;
const BUCKET_ORIGIN = 128;

export interface RiverNetwork {
  count: number;
  x: Float32Array;
  y: Float32Array;
  bed: Float32Array;
  flux: Float32Array;
  buckets: Map<number, number[]>;
}

const bucketKey = (x: number, y: number): number =>
  Math.floor((y + BUCKET_ORIGIN) / BUCKET_TILES) * 8192 + Math.floor((x + BUCKET_ORIGIN) / BUCKET_TILES);

export const halfWidthOf = (flux: number): number => Math.min(WIDEST, NARROWEST * Math.sqrt(flux / RIVER_FLUX));

const lateral = (x: number, y: number, seed: number): [number, number] => [
  (noise2(x / LATERAL_WAVE, y / LATERAL_WAVE, seed + 3301) - 0.5) * 2 * LATERAL_REACH,
  (noise2(x / LATERAL_WAVE, y / LATERAL_WAVE, seed + 7717) - 0.5) * 2 * LATERAL_REACH,
];

export function buildNetwork(coarse: CoarseField, threshold = BIG_RIVER_FLUX): RiverNetwork {
  const { grid, flow, flux, seed, spacing } = coarse;
  const cellX = (cell: number): number => grid.x(cell % grid.columns);
  const cellY = (cell: number): number => grid.y(Math.floor(cell / grid.columns));
  const isBig = (cell: number): boolean => flow.water[cell] === Water.None && flow.sink[cell] !== 1 && flow.into[cell]! >= 0 && flux[cell]! >= threshold;

  const xs: number[] = [];
  const ys: number[] = [];
  const beds: number[] = [];
  const fluxes: number[] = [];
  const bedIn = new Float32Array(grid.count).fill(Infinity);

  for (let i = flow.reached.length - 1; i >= 0; i -= 1) {
    const cell = flow.reached[i]!;
    if (!isBig(cell)) continue;
    const down = flow.into[cell]!;
    const ax = cellX(cell);
    const ay = cellY(cell);
    const bx = cellX(down);
    const by = cellY(down);
    const toWater = flow.water[down] !== Water.None;
    const endFlux = toWater ? flux[cell]! : flux[down]!;
    let bed = bedIn[cell]!;
    for (let s = 0; s < spacing; s += 1) {
      const t = s / spacing;
      const px = ax + (bx - ax) * t;
      const py = ay + (by - ay) * t;
      const [dx, dy] = lateral(px, py, seed);
      const x = px + dx;
      const y = py + dy;
      bed = Math.min(bed - BED_FALL, baseHeight(x, y, seed, BED_FINEST));
      xs.push(x);
      ys.push(y);
      beds.push(bed);
      fluxes.push(flux[cell]! + (endFlux - flux[cell]!) * t);
    }
    if (!toWater) bedIn[down] = Math.min(bedIn[down]!, bed);
  }

  const buckets = new Map<number, number[]>();
  for (let i = 0; i < xs.length; i += 1) {
    const key = bucketKey(xs[i]!, ys[i]!);
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }

  return { count: xs.length, x: Float32Array.from(xs), y: Float32Array.from(ys), bed: Float32Array.from(beds), flux: Float32Array.from(fluxes), buckets };
}

function samplesNear(network: RiverNetwork, minX: number, minY: number, maxX: number, maxY: number, visit: (sample: number) => void): void {
  for (let by = Math.floor((minY + BUCKET_ORIGIN) / BUCKET_TILES); by <= Math.floor((maxY + BUCKET_ORIGIN) / BUCKET_TILES); by += 1) {
    for (let bx = Math.floor((minX + BUCKET_ORIGIN) / BUCKET_TILES); bx <= Math.floor((maxX + BUCKET_ORIGIN) / BUCKET_TILES); bx += 1) {
      const list = network.buckets.get(by * 8192 + bx);
      if (list) for (const sample of list) visit(sample);
    }
  }
}

export function carveRivers(network: RiverNetwork, grid: TileGrid, height: Float32Array): void {
  const reach = BANK_REACH_TILES + WIDEST;
  const minX = grid.minX - reach;
  const minY = grid.minY - reach;
  const maxX = grid.minX + grid.columns + reach;
  const maxY = grid.minY + grid.rows + reach;
  samplesNear(network, minX + 0, minY + 0, maxX, maxY, (sample) => {
    const x = network.x[sample]!;
    const y = network.y[sample]!;
    const half = halfWidthOf(network.flux[sample]!);
    const span = Math.ceil(half + BANK_REACH_TILES);
    const column = Math.floor(x - grid.minX);
    const row = Math.floor(y - grid.minY);
    for (let r = Math.max(0, row - span); r <= Math.min(grid.rows - 1, row + span); r += 1) {
      for (let c = Math.max(0, column - span); c <= Math.min(grid.columns - 1, column + span); c += 1) {
        const distance = Math.hypot(grid.minX + c + 0.5 - x, grid.minY + r + 0.5 - y);
        if (distance > span) continue;
        const level = network.bed[sample]! + BANK_SLOPE * Math.max(0, distance - half);
        const at = r * grid.columns + c;
        if (level < height[at]!) height[at] = level;
      }
    }
  });
}

export function lendFlux(network: RiverNetwork, grid: TileGrid, flux: Float32Array): void {
  const minX = grid.minX - 2;
  const minY = grid.minY - 2;
  const maxX = grid.minX + grid.columns + 2;
  const maxY = grid.minY + grid.rows + 2;
  samplesNear(network, minX, minY, maxX, maxY, (sample) => {
    const x = network.x[sample]!;
    const y = network.y[sample]!;
    const column = Math.floor(x - grid.minX);
    const row = Math.floor(y - grid.minY);
    if (column < 0 || column >= grid.columns || row < 0 || row >= grid.rows) return;
    const at = row * grid.columns + column;
    if (network.flux[sample]! > flux[at]!) flux[at] = network.flux[sample]!;
  });
}
