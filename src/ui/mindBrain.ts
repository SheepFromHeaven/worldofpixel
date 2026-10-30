import { MIND, MIND_LOCKED, MIND_REGIONS } from '../render/palette.ts';
import { REGIONS } from '../content/research/regions.ts';
import { TREE_HEIGHT, TREE_WIDTH, hash, packOf } from './mindArt.ts';
import type { Spot } from './mindArt.ts';

const CELL = 2;

const COLUMNS = TREE_WIDTH / CELL;

const ROWS = TREE_HEIGHT / CELL;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const SEEDS: readonly Spot[] = [
  { x: 0.6, y: 0.74 },
  { x: 0.2, y: 0.44 },
  { x: 0.44, y: 0.17 },
  { x: 0.78, y: 0.4 },
  { x: 0.36, y: 0.64 },
];

const smooth = (value: number): number => value * value * (3 - 2 * value);

function noise(x: number, y: number, seed: number): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const fx = smooth(x - cx);
  const fy = smooth(y - cy);
  const top = hash(cx + seed, cy) * (1 - fx) + hash(cx + 1 + seed, cy) * fx;
  const bottom = hash(cx + seed, cy + 1) * (1 - fx) + hash(cx + 1 + seed, cy + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

const ellipse = (u: number, v: number, cx: number, cy: number, rx: number, ry: number): number => Math.hypot((u - cx) / rx, (v - cy) / ry);

function reach(u: number, v: number): number {
  const wobble = (noise(u * 22, v * 22, 3) - 0.5) * 0.1;
  const cerebrum = ellipse(u, v, 0.48, 0.4, 0.43, v > 0.45 ? 0.27 : 0.3);
  const temporal = ellipse(u, v, 0.4, 0.58, 0.19, 0.11);
  const cerebellum = ellipse(u, v, 0.68, 0.7, 0.16, 0.11);
  const along = Math.max(0, Math.min(1, (v - 0.6) / 0.34));
  const stem = Math.abs(u - (0.56 + along * 0.04)) / 0.036 + (v < 0.6 || v > 0.9 ? 9 : 0);
  return Math.min(cerebrum, temporal, cerebellum, stem) + wobble;
}

interface BrainMap {
  region: Int8Array;
  depth: Float32Array;
  fold: Uint8Array;
  centre: Spot[];
}

let cached: BrainMap | null = null;

function build(): BrainMap {
  const region = new Int8Array(COLUMNS * ROWS).fill(-1);
  const depth = new Float32Array(COLUMNS * ROWS);
  const fold = new Uint8Array(COLUMNS * ROWS);
  const sums = REGIONS.map(() => ({ x: 0, y: 0, count: 0 }));
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const u = (column + 0.5) / COLUMNS;
      const v = (row + 0.5) / ROWS;
      const away = reach(u, v);
      if (away > 1) continue;
      const at = row * COLUMNS + column;
      const wu = u + (noise(u * 9, v * 9, 11) - 0.5) * 0.14;
      const wv = v + (noise(u * 9, v * 9, 29) - 0.5) * 0.14;
      let best = 0;
      let least = Infinity;
      SEEDS.forEach((seed, index) => {
        const gap = Math.hypot(wu - seed.x, (wv - seed.y) * 1.15);
        if (gap < least) {
          least = gap;
          best = index;
        }
      });
      region[at] = best;
      depth[at] = Math.max(0, 1 - away);
      const ridge = Math.sin(u * 46 + noise(u * 7, v * 7, 5) * 9) + Math.sin(v * 38 + noise(u * 6, v * 6, 8) * 8);
      fold[at] = ridge > 1.55 ? 1 : 0;
      const sum = sums[best]!;
      sum.x += column;
      sum.y += row;
      sum.count += 1;
    }
  }
  const centre = sums.map((sum, index) => (sum.count > 0 ? { x: (sum.x / sum.count) * CELL, y: (sum.y / sum.count) * CELL } : { x: SEEDS[index]!.x * TREE_WIDTH, y: SEEDS[index]!.y * TREE_HEIGHT }));
  return { region, depth, fold, centre };
}

const mapOf = (): BrainMap => {
  cached ??= build();
  return cached;
};

export const regionCentre = (region: number): Spot => mapOf().centre[region]!;

export function regionAt(point: Spot): number {
  const column = Math.floor(point.x / CELL);
  const row = Math.floor(point.y / CELL);
  if (column < 0 || row < 0 || column >= COLUMNS || row >= ROWS) return -1;
  return mapOf().region[row * COLUMNS + column]!;
}

export interface RegionState {
  open: boolean;
  waiting: boolean;
}

const rampPacks = MIND_REGIONS.map((ramp) => ramp.map(packOf));

const lockedPack = MIND_LOCKED.map(packOf);

const inkPack = packOf(MIND.deep);

let image: ImageData | null = null;

let layer: HTMLCanvasElement | null = null;

export function drawBrain(ctx: CanvasRenderingContext2D, states: readonly RegionState[], hover: number, time: number): void {
  const map = mapOf();
  image ??= new ImageData(TREE_WIDTH, TREE_HEIGHT);
  if (!layer) {
    layer = document.createElement('canvas');
    layer.width = TREE_WIDTH;
    layer.height = TREE_HEIGHT;
  }
  const pixels = new Uint32Array(image.data.buffer);
  pixels.fill(0);
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const at = row * COLUMNS + column;
      const region = map.region[at]!;
      if (region < 0) continue;
      const state = states[region]!;
      const ramp = state.open ? rampPacks[region]! : lockedPack;
      const edge = map.region[at + 1] !== region || map.region[at + COLUMNS] !== region || map.region[at - 1] !== region || map.region[at - COLUMNS] !== region;
      const rimmed = map.depth[at]! < 0.07;
      const light = 0.5 + map.depth[at]! * 0.9 - ((column / COLUMNS + row / ROWS) - 0.9) * 0.35;
      const lifted = region === hover ? 0.25 : state.waiting && state.open ? 0.12 * (1 + Math.sin(time * 3)) : 0;
      const level = Math.max(0, Math.min(2, light + lifted - (map.fold[at] ? 0.55 : 0) - 0.2));
      const lower = Math.floor(level);
      const step = Math.min(2, BAYER[(row & 3) * 4 + (column & 3)]! / 16 < level - lower ? lower + 1 : lower);
      const colour = edge || rimmed ? inkPack : ramp[step]!;
      const x = column * CELL;
      const y = row * CELL;
      pixels[y * TREE_WIDTH + x] = colour;
      pixels[y * TREE_WIDTH + x + 1] = colour;
      pixels[(y + 1) * TREE_WIDTH + x] = colour;
      pixels[(y + 1) * TREE_WIDTH + x + 1] = colour;
    }
  }
  layer.getContext('2d')!.putImageData(image, 0, 0);
  ctx.drawImage(layer, 0, 0);
}

export function labelOf(region: number): string {
  return REGIONS[region]?.label ?? '';
}
