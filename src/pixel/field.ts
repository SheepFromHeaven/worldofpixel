export type Mask = (x: number, y: number) => boolean;

export const and = (a: Mask, b: Mask): Mask => (x, y) => a(x, y) && b(x, y);
export const not = (mask: Mask): Mask => (x, y) => !mask(x, y);
export const or = (a: Mask, b: Mask): Mask => (x, y) => a(x, y) || b(x, y);

export function spans(rows: readonly (readonly [number, number] | undefined)[]): Mask {
  return (x, y) => {
    const row = rows[y];
    return row !== undefined && x >= row[0] && x < row[1];
  };
}

export function blob(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  wobble: number,
  seed: number,
): Mask {
  const phases = [noise(seed, 1), noise(seed, 2), noise(seed, 3)].map((n) => n * Math.PI * 2);

  return (x, y) => {
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    const angle = Math.atan2(dy, dx);
    const edge =
      1 +
      wobble *
        (Math.sin(angle * 3 + (phases[0] ?? 0)) * 0.5 +
          Math.sin(angle * 5 + (phases[1] ?? 0)) * 0.32 +
          Math.sin(angle * 7 + (phases[2] ?? 0)) * 0.18);

    return Math.hypot(dx, dy) <= edge;
  };
}

export const capsule = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius: number,
): Mask => (x, y) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const along = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / along));
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  return (x - px) ** 2 + (y - py) ** 2 <= radius * radius;
};

export const ellipse = (cx: number, cy: number, rx: number, ry: number): Mask => (x, y) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

export const touching = (mask: Mask, other: Mask): Mask => (x, y) =>
  mask(x, y) &&
  (other(x - 1, y) || other(x + 1, y) || other(x, y - 1) || other(x, y + 1));

export interface Field {
  readonly size: number;
  depth(x: number, y: number): number;
  readonly deepest: number;
}

const cached = new WeakMap<Mask, Map<number, Field>>();

export function measure(size: number, mask: Mask): Field {
  let sizes = cached.get(mask);
  if (!sizes) {
    sizes = new Map();
    cached.set(mask, sizes);
  }

  const known = sizes.get(size);
  if (known) return known;

  const field = depthField(size, mask);
  sizes.set(size, field);
  return field;
}

export function depthField(size: number, mask: Mask): Field {
  const inside: number[] = [];
  const outside: number[] = [];

  for (let y = -1; y <= size; y += 1) {
    for (let x = -1; x <= size; x += 1) {
      if (mask(x, y)) {
        if (x >= 0 && y >= 0 && x < size && y < size) inside.push(y * size + x);
      } else {
        outside.push((y + 1) * (size + 2) + (x + 1));
      }
    }
  }

  const depths = new Float64Array(size * size);
  let deepest = 0;

  for (const cell of inside) {
    const x = cell % size;
    const y = Math.floor(cell / size);
    let nearest = Infinity;

    for (const open of outside) {
      const ox = (open % (size + 2)) - 1;
      const oy = Math.floor(open / (size + 2)) - 1;
      const squared = (ox - x) * (ox - x) + (oy - y) * (oy - y);
      if (squared < nearest) nearest = squared;
    }

    const depth = Math.sqrt(nearest);
    depths[cell] = depth;
    if (depth > deepest) deepest = depth;
  }

  return {
    size,
    deepest,
    depth: (x, y) =>
      x < 0 || y < 0 || x >= size || y >= size ? 0 : (depths[y * size + x] ?? 0),
  };
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function bayer(x: number, y: number): number {
  return ((BAYER[((y % 4) + 4) % 4]?.[((x % 4) + 4) % 4] ?? 0) + 0.5) / 16;
}

export function noise(x: number, y: number, salt = 0): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
