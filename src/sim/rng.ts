export type Random = () => number;

export function prng(seed: number): Random {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function corner(x: number, y: number, seed: number): number {
  let h = Math.imul(x + 0x9e37, 0x85ebca6b) ^ Math.imul(y + 0x7f4a, 0xc2b2ae35) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

export const hash2 = corner;

export function noise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const a = corner(xi, yi, seed);
  const b = corner(xi + 1, yi, seed);
  const c = corner(xi, yi + 1, seed);
  const d = corner(xi + 1, yi + 1, seed);

  const top = a + (b - a) * u;
  return top + (c + (d - c) * u - top) * v;
}

function corner3(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x + 0x9e37, 0x85ebca6b) ^ Math.imul(y + 0x7f4a, 0xc2b2ae35) ^ Math.imul(z + 0x5bd1, 0x27d4eb2f) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

export const hash3 = corner3;

export function noise3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);

  const layer = (k: number): number => {
    const a = corner3(xi, yi, k, seed);
    const b = corner3(xi + 1, yi, k, seed);
    const c = corner3(xi, yi + 1, k, seed);
    const d = corner3(xi + 1, yi + 1, k, seed);
    const top = a + (b - a) * u;
    const bottom = c + (d - c) * u;
    return top + (bottom - top) * v;
  };

  const near = layer(zi);
  const far = layer(zi + 1);
  return near + (far - near) * w;
}

const SPREAD_2 = [0, 0.149, 0.21, 0.258, 0.3, 0.338, 0.372, 0.406, 0.438, 0.469, 0.501, 0.531, 0.562, 0.595, 0.628, 0.663, 0.701, 0.742, 0.79, 0.852, 1];
const SPREAD_3 = [0, 0.194, 0.253, 0.297, 0.333, 0.366, 0.395, 0.423, 0.449, 0.475, 0.5, 0.525, 0.551, 0.577, 0.605, 0.634, 0.666, 0.703, 0.747, 0.806, 1];

function spread(table: readonly number[], value: number): number {
  const last = table.length - 1;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  let low = 0;
  while (low < last - 1 && table[low + 1]! <= value) low += 1;
  const from = table[low]!;
  const to = table[low + 1]!;
  return (low + (to > from ? (value - from) / (to - from) : 0)) / last;
}

export const spread2 = (value: number): number => spread(SPREAD_2, value);

export const spread3 = (value: number): number => spread(SPREAD_3, value);

export function hashBits(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x + 0x9e37, 0x85ebca6b) ^ Math.imul(y + 0x7f4a, 0xc2b2ae35) ^ Math.imul(z + 0x5bd1, 0x27d4eb2f) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}
