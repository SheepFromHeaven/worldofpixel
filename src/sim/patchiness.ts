export interface Grain {
  salt: number;
  scale: number;
  cover: number;
}

function hash(x: number, y: number, salt: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, salt: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, salt);
  const b = hash(ix + 1, iy, salt);
  const c = hash(ix, iy + 1, salt);
  const d = hash(ix + 1, iy + 1, salt);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const MAX_GAIN = 4;

const gains = new WeakMap<readonly Grain[], number>();

export function patchiness(seed: number, grain: readonly Grain[], column: number, row: number): number {
  let weight = 1;
  let gain = gains.get(grain);
  if (gain === undefined) {
    gain = Math.min(MAX_GAIN, 1 / grain.reduce((all, layer) => all * layer.cover, 1));
    gains.set(grain, gain);
  }

  for (const layer of grain) {
    const near = valueNoise(column / layer.scale, row / layer.scale, layer.salt * 977 + seed);
    const fine = valueNoise(column / (layer.scale * 0.43), row / (layer.scale * 0.43), layer.salt * 331 + seed + 11);
    const level = near * 0.7 + fine * 0.3;
    const edge = 0.5 + (0.5 - layer.cover) * 0.55;
    const t = Math.min(1, Math.max(0, (level - edge) / 0.1));
    weight *= t * t * (3 - 2 * t);
    if (weight === 0) return 0;
  }
  return weight * gain;
}

