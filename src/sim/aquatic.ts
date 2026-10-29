import { distanceFrom } from './distance.ts';
import { hash2, noise2 } from './rng.ts';
import { PEAK_METRES } from './terrain/climate.ts';
import { SEA_LEVEL } from './terrain/heightmap.ts';
import type { WorldField } from './terrain/worldfield.ts';
import { gapTo } from './terrain/worldfield.ts';
import { Biome } from './types.ts';

export const Aqua = { None: 0, Reeds: 1, Lily: 2, Algae: 3, Seagrass: 4, Kelp: 5, Weed: 6 } as const;

export type Aqua = (typeof Aqua)[keyof typeof Aqua];

export const AQUA_NAMES: readonly string[] = ['', 'reeds', 'lily', 'algae', 'seagrass', 'kelp', 'weed'];

export const FASTEST_FLOW = 2.4;

export const SLOWEST_FLOW = 0.45;

export const flowSpeedFor = (metresDroppedPerMetre: number): number =>
  Math.min(FASTEST_FLOW, Math.max(SLOWEST_FLOW, 0.5 + Math.max(0, metresDroppedPerMetre) / 45));

export const flowOf = (byte: number): number => (byte / 255) * FASTEST_FLOW;

const BANK_TILES = 0.4;

const SHORTEST_SEGMENT_LENGTH = 0.5;

export const SHELF_METRES_PER_TILE = 0.9;

export const DEPTH_UNIT_METRES = 0.1;

const FLOW_STILL = 0.12;

export const BANK_SOFTNESS: readonly number[] = [0.5, 0.55, 0.08, 0.9, 0.12, 0.3, 0.04, 0.03, 0.4, 0.2, 0.85];

const MURK_REACH_TILES = 3;

const FLOW_SILT_SHARE = 0.65;

function boxSum(source: Float32Array, columns: number, rows: number, reach: number): Float32Array {
  const across = new Float32Array(source.length);
  for (let row = 0; row < rows; row += 1) {
    const base = row * columns;
    let sum = 0;
    for (let column = 0; column < Math.min(columns, reach); column += 1) sum += source[base + column]!;
    for (let column = 0; column < columns; column += 1) {
      const entering = column + reach;
      const leaving = column - reach - 1;
      if (entering < columns) sum += source[base + entering]!;
      if (leaving >= 0) sum -= source[base + leaving]!;
      across[base + column] = sum;
    }
  }
  const down = new Float32Array(source.length);
  for (let column = 0; column < columns; column += 1) {
    let sum = 0;
    for (let row = 0; row < Math.min(rows, reach); row += 1) sum += across[row * columns + column]!;
    for (let row = 0; row < rows; row += 1) {
      const entering = row + reach;
      const leaving = row - reach - 1;
      if (entering < rows) sum += across[entering * columns + column]!;
      if (leaving >= 0) sum -= across[leaving * columns + column]!;
      down[row * columns + column] = sum;
    }
  }
  return down;
}

function murkFor(field: WorldField, flow: Uint8Array, depths: Uint8Array, shores: Uint8Array, isWater: (i: number) => boolean): { silt: Uint8Array; bloom: Uint8Array } {
  const { grid } = field;
  const count = grid.count;
  const land = new Float32Array(count);
  const soft = new Float32Array(count);
  const rich = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    if (isWater(i)) continue;
    land[i] = 1;
    soft[i] = BANK_SOFTNESS[field.biome[i]!] ?? 0.4;
    rich[i] = field.fertility[i]! / 255;
  }
  const landSum = boxSum(land, grid.columns, grid.rows, MURK_REACH_TILES);
  const softSum = boxSum(soft, grid.columns, grid.rows, MURK_REACH_TILES);
  const richSum = boxSum(rich, grid.columns, grid.rows, MURK_REACH_TILES);
  const silt = new Uint8Array(count);
  const bloom = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) {
    if (!isWater(i)) continue;
    const near = landSum[i]!;
    const bank = near > 0 ? softSum[i]! / near : 0;
    const feed = near > 0 ? richSum[i]! / near : 0;
    const biome = field.biome[i]!;
    const moving = flow[i]! / 255;
    const open = biome === Biome.Ocean ? Math.exp(-shores[i]! / 5) * 0.5 : biome === Biome.Lake ? Math.exp(-shores[i]! / 14) : 1;
    const stirred = FLOW_SILT_SHARE * moving + (1 - FLOW_SILT_SHARE) * 0.5;
    silt[i] = Math.round(255 * Math.min(1, bank * stirred * open * 1.5));
    const metres = depths[i]! * DEPTH_UNIT_METRES;
    const calm = 1 - Math.min(1, moving * 4);
    const shallow = 1 - smooth(1.5, 7, metres);
    const salt = biome === Biome.Ocean ? 0.35 : 1;
    bloom[i] = Math.round(255 * Math.min(1, feed * calm * (0.4 + 0.6 * shallow) * salt * 1.2));
  }
  return { silt, bloom };
}

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export interface Aquatic {
  readonly silt: Uint8Array;
  readonly bloom: Uint8Array;
  readonly aqua: Uint8Array;
  readonly flow: Uint8Array;
  readonly depth: Uint8Array;
  readonly shore: Uint8Array;
}

function flowField(field: WorldField): { flow: Uint8Array; ribbon: Uint8Array } {
  const { grid, height, rivers } = field;
  const flow = new Uint8Array(grid.count);
  const ribbon = new Uint8Array(grid.count);

  for (const segment of rivers.segments) {
    const length = Math.max(Math.hypot(segment.bx - segment.ax, segment.by - segment.ay), SHORTEST_SEGMENT_LENGTH);
    const start = height[grid.atPoint({ x: segment.ax, y: segment.ay })] ?? 0;
    const end = height[grid.atPoint({ x: segment.bx, y: segment.by })] ?? 0;
    const speed = flowSpeedFor(((start - end) * PEAK_METRES) / length);
    const byte = Math.round((speed / FASTEST_FLOW) * 255);

    const reach = segment.half + BANK_TILES;
    const first = grid.column(Math.min(segment.ax, segment.bx) - reach);
    const last = grid.column(Math.max(segment.ax, segment.bx) + reach);
    const top = grid.row(Math.min(segment.ay, segment.by) - reach);
    const bottom = grid.row(Math.max(segment.ay, segment.by) + reach);

    for (let row = top; row <= bottom; row += 1) {
      for (let column = first; column <= last; column += 1) {
        const gap = gapTo(segment, grid.x(column), grid.y(row));
        if (gap > reach * reach) continue;
        const i = row * grid.columns + column;
        if (byte > flow[i]!) flow[i] = byte;
        if (gap <= segment.half * segment.half) ribbon[i] = 1;
      }
    }
  }

  return { flow, ribbon };
}

interface Conditions {
  readonly celsius: number;
  readonly depth: number;
  readonly shore: number;
  readonly flow: number;
  readonly salt: boolean;
  readonly bank: boolean;
}

export function suitability(c: Conditions): readonly number[] {
  const warm = smooth(3, 12, c.celsius);
  const still = 1 - smooth(FLOW_STILL, 0.3, c.flow);
  const fresh = c.salt ? 0 : 1;

  const reeds = fresh * warm * (c.bank ? 1 - smooth(0.3, 0.8, c.flow) : (1 - smooth(1.5, 4, c.shore)) * (1 - smooth(0.8, 2.2, c.depth)) * still);
  const lily = fresh * smooth(6, 14, c.celsius) * still * smooth(0.3, 0.9, c.depth) * (1 - smooth(3, 5, c.depth)) * smooth(1, 3, c.shore) * (1 - smooth(8, 14, c.shore)) * (c.bank ? 0 : 1);
  const algae = fresh * smooth(14, 22, c.celsius) * still * (1 - smooth(1.5, 4, c.depth)) * (c.bank ? 0 : 1);
  const seagrass = c.salt ? smooth(0.3, 1, c.depth) * (1 - smooth(5, 9, c.depth)) * smooth(8, 16, c.celsius) : 0;
  const kelp = c.salt ? smooth(1.5, 4, c.depth) * (1 - smooth(15, 24, c.depth)) * (1 - smooth(14, 20, c.celsius)) * smooth(-2, 5, c.celsius) : 0;
  const weed = fresh * smooth(0, 8, c.celsius) * smooth(0.2, 0.45, c.flow) * (1 - smooth(0.8, 0.95, c.flow)) * (c.bank ? 0 : 1);

  return [0, reeds, lily, algae, seagrass, kelp, weed];
}

const PATCH_WAVE = [0, 7, 9, 12, 16, 22, 6];

export function aquaticFor(seed: number, field: WorldField, river: Uint8Array): Aquatic {
  const { grid } = field;
  const { flow, ribbon } = flowField(field);
  const aqua = new Uint8Array(grid.count);
  const depths = new Uint8Array(grid.count);
  const shores = new Uint8Array(grid.count);

  const land = new Uint8Array(grid.count);
  for (let i = 0; i < grid.count; i += 1) land[i] = field.biome[i] === Biome.Ocean || field.biome[i] === Biome.Lake ? 0 : 1;
  const shoreDistance = distanceFrom(grid, land);

  for (let row = 0; row < grid.rows; row += 1) {
    const y = grid.y(row);
    for (let column = 0; column < grid.columns; column += 1) {
      const i = row * grid.columns + column;
      const biome = field.biome[i]!;
      const standing = biome === Biome.Ocean || biome === Biome.Lake;
      if (!standing && river[i] !== 1) continue;

      const shore = standing ? shoreDistance[i]! : 0;

      const surface = biome === Biome.Ocean ? SEA_LEVEL : field.surface[i]!;
      const rawDepth = standing ? ((surface - field.height[i]!) / (1 - SEA_LEVEL)) * PEAK_METRES : 0;
      const depth = standing ? Math.min(Math.max(rawDepth, 0.2), 0.4 + shore * SHELF_METRES_PER_TILE) : 0.4 + (flow[i]! > 0 ? 0.3 : 0);
      depths[i] = Math.min(255, Math.round(depth / DEPTH_UNIT_METRES));
      shores[i] = Math.min(255, Math.round(shore));
      if (biome === Biome.Ocean && shore > 14) continue;

      const conditions: Conditions = {
        celsius: field.temperature[i]!,
        depth,
        shore,
        flow: flowOf(flow[i]!),
        salt: biome === Biome.Ocean,
        bank: !standing && ribbon[i] === 0,
      };

      const x = grid.x(column);
      const scores = suitability(conditions);
      let best = 0;
      let bestScore = 0;
      for (let kind = 1; kind < scores.length; kind += 1) {
        const patch = smooth(0.3, 0.6, noise2(x / PATCH_WAVE[kind]!, y / PATCH_WAVE[kind]!, seed + 900 + kind * 13));
        const score = scores[kind]! * patch;
        if (score > bestScore) {
          bestScore = score;
          best = kind;
        }
      }
      if (best > 0 && hash2(column, row, seed + 1303) < bestScore) aqua[i] = best;
    }
  }

  const wet = (i: number): boolean => field.biome[i] === Biome.Ocean || field.biome[i] === Biome.Lake || river[i] === 1;
  const { silt, bloom } = murkFor(field, flow, depths, shores, wet);
  return { silt, bloom, aqua, flow, depth: depths, shore: shores };
}
