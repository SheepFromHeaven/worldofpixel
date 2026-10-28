import { groundSprites, materialOf } from '../render/groundSprites.ts';
import type { Variant } from '../render/groundSprites.ts';
import { BIOME_RAMPS } from '../render/palette.ts';
import type { Terrain } from './stage.ts';

const SIZE = 512;

const LATTICE = 8;

const WEIGHTS: readonly number[] = [0.6, 0.25, 0.15];

const cache = new Map<string, CanvasPattern>();

const hashOf = (x: number, y: number, seed: number): number => {
  let h = Math.imul(x + 1, 0x27d4eb2d) ^ Math.imul(y + 1, 0x165667b1) ^ Math.imul(seed + 1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

const noiseAt = (x: number, y: number, seed: number): number => {
  const cell = SIZE / LATTICE;
  const fx = x / cell;
  const fy = y / cell;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const at = (dx: number, dy: number): number => hashOf((x0 + dx) % LATTICE, (y0 + dy) % LATTICE, seed);
  const top = at(0, 0) + (at(1, 0) - at(0, 0)) * tx;
  const bottom = at(0, 1) + (at(1, 1) - at(0, 1)) * tx;
  return top + (bottom - top) * ty;
};

const variantIndex = (value: number, count: number): number => {
  let edge = 0;
  for (let index = 0; index < count - 1; index += 1) {
    edge += WEIGHTS[index] ?? 0;
    if (value < edge) return index;
  }
  return count - 1;
};

const colourOf = (packed: number): [number, number, number] => [(packed >>> 24) & 255, (packed >>> 16) & 255, (packed >>> 8) & 255];

export function groundPattern(ctx: CanvasRenderingContext2D, terrain: Terrain): CanvasPattern | null {
  const cached = cache.get(terrain.key);
  if (cached) return cached;
  const sprites = groundSprites();
  const material = materialOf(terrain.ground.biome);
  if (!sprites || !material) return null;
  const variants: Variant[] = sprites.variants.get(material === 'desert' ? 'desert:ns' : material) ?? [];
  if (variants.length === 0) return null;
  const ramp = BIOME_RAMPS[terrain.ground.biome]!.map(colourOf);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const paint = canvas.getContext('2d');
  if (!paint) return null;
  const image = paint.createImageData(SIZE, SIZE);
  const size = sprites.size;
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const variant = variants[variantIndex(noiseAt(x, y, 7), variants.length)]!;
      const step = variant.mips[0]![(y % size) * size + (x % size)]!;
      const [r, g, b] = ramp[Math.min(ramp.length - 1, step)]!;
      const at = (y * SIZE + x) * 4;
      image.data[at] = r;
      image.data[at + 1] = g;
      image.data[at + 2] = b;
      image.data[at + 3] = 255;
    }
  }
  paint.putImageData(image, 0, 0);
  const pattern = ctx.createPattern(canvas, 'repeat');
  if (pattern) cache.set(terrain.key, pattern);
  return pattern;
}
