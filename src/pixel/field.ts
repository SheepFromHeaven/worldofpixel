/** Which cells of a sprite a region covers. */
export type Mask = (x: number, y: number) => boolean;

export const and = (a: Mask, b: Mask): Mask => (x, y) => a(x, y) && b(x, y);
export const not = (mask: Mask): Mask => (x, y) => !mask(x, y);
export const or = (a: Mask, b: Mask): Mask => (x, y) => a(x, y) || b(x, y);

/**
 * A silhouette drawn as how far each row reaches, which is how a shape with any character to it
 * gets authored. An ellipse is one line of arithmetic and comes out as a bullseye; the dents and
 * the flat on one side are what make a shape read as worn into the ground rather than stamped.
 *
 * `rows[y]` is the half-open span `[from, to)` that row covers, or nothing for an empty row.
 */
export function spans(rows: readonly (readonly [number, number] | undefined)[]): Mask {
  return (x, y) => {
    const row = rows[y];
    return row !== undefined && x >= row[0] && x < row[1];
  };
}

/**
 * An ellipse with the edge pushed in and out as it goes round — a pool, a boulder, a clearing.
 *
 * A plain ellipse reads as a stamp, and spans typed row by row stop being worth it somewhere
 * around forty cells. A few harmonics give an edge that wanders without ever doubling back, and
 * `seed` is the only thing that chooses which way: the same seed is the same shape for ever, so
 * a sprite is still a thing someone settled on rather than a thing that came out of a generator.
 */
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

/**
 * A thick line with rounded ends — a log, a branch, a beam, a fallen column.
 *
 * Worth having as a shape rather than a stamp of dark cells: anything built from a mask gets
 * lit by whatever lights the sprite, and a log lying in a fire has to be lit by that fire or it
 * reads as a hole cut in the flames.
 */
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

/** The round case, for when round is what is wanted. */
export const ellipse = (cx: number, cy: number, rx: number, ry: number): Mask => (x, y) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** The cells of `mask` that share an edge with `other` — a shore, a seam, a scorch mark. */
export const touching = (mask: Mask, other: Mask): Mask => (x, y) =>
  mask(x, y) &&
  (other(x - 1, y) || other(x + 1, y) || other(x, y - 1) || other(x, y + 1));

/** A region's cells laid out row by row, with how far each one is from leaving the region. */
export interface Field {
  readonly size: number;
  /** Distance from the cell to the nearest cell outside the region; 0 when it is outside. */
  depth(x: number, y: number): number;
  /** The deepest any cell in the region gets, so a depth can be read as a fraction. */
  readonly deepest: number;
}

/**
 * How far every cell sits inside its region, measured straight rather than in steps.
 *
 * This is the one measurement everything else is built on: a region's shape is a silhouette and
 * nothing more, and the distance to its edge is what turns that silhouette into something with a
 * near side and a far side. Heights come from it, and normals from those.
 *
 * Measured against every cell outside the region rather than grown outwards in rings, because
 * rings are the Chebyshev distance wearing a hat: on a diagonal edge they run a cell and a half
 * ahead of the truth, and the bank of a round pool comes out with corners.
 */
const cached = new WeakMap<Mask, Map<number, Field>>();

/**
 * As `depthField`, but remembered against the mask it was measured from.
 *
 * Masks are the one part of a sprite that does not move when the lighting does, and measuring
 * one is the most expensive thing here by a wide margin. The lab re-lights a sprite on every
 * frame of a drag; without this it would re-measure every region each time and the handle would
 * stutter. Keyed on the mask's identity, so a region built fresh inside a draw call misses —
 * which is why sprites declare their regions once, at the top level.
 */
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

/**
 * Ordered dither threshold for a cell, from a 4x4 Bayer matrix.
 *
 * Wherever two colours have to meet across a gradient — two steps of a ramp, or two ramps —
 * this is how. Rounding gives hard bands, random choice gives television static; a Bayer
 * threshold spreads the remainder over a block so one side stipples into the other, which is how
 * pixel art has always drawn more colours than it has.
 *
 * Takes absolute coordinates, never coordinates within the shape being drawn. A pattern anchored
 * to the shape moves when the shape does.
 */
export function bayer(x: number, y: number): number {
  return ((BAYER[((y % 4) + 4) % 4]?.[((x % 4) + 4) % 4] ?? 0) + 0.5) / 16;
}

/**
 * Deterministic speckle. Everything in here has to come out the same on every run — the tile is
 * committed, and a sprite that changed each time it was generated would show up as noise in the
 * diff and never as a decision.
 */
export function noise(x: number, y: number, salt = 0): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
