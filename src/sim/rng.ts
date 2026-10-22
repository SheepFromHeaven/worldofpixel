export type Random = () => number;

export function rng(seed: number): Random {
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

/**
 * One hash of a lattice corner, as a 0..1 number. No closure, no allocation.
 *
 * `rng(seed)()` would do the same job and reads better, but the world field asks for this four
 * times an octave and six octaves a sample over a quarter of a million cells, and a generator
 * object per corner was most of the time a world took to build.
 */
function corner(x: number, y: number, seed: number): number {
  let h = Math.imul(x + 0x9e37, 0x85ebca6b) ^ Math.imul(y + 0x7f4a, 0xc2b2ae35) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Deterministic value noise: the same (x, y, seed) always gives the same number. */
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
