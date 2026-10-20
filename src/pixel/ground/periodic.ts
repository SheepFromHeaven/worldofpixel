/**
 * Arithmetic for drawings that tile: every function here wraps on `period`, so the cell past the
 * right edge is the cell at the left edge and a texture laid edge to edge has no seam.
 *
 * That is the one property a ground texture cannot do without. The ground is read at world
 * position, so a texture repeats every `period` texels in both directions across the whole map,
 * and anything that does not wrap draws the repeat as a grid of lines.
 */

export const wrap = (value: number, period: number): number => ((value % period) + period) % period;

/** A deterministic number in [0, 1) for a lattice point, the same for every run. */
export function hash(x: number, y: number, salt: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * Value noise on a lattice of `cells` squares across the period. `cells` has to divide nothing in
 * particular — the lattice itself wraps — but a whole number of cells is what makes it tile.
 */
export function valueNoise(x: number, y: number, period: number, cells: number, salt: number, rows = cells): number {
  const fx = (x / period) * cells;
  const fy = (y / period) * rows;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const u = smooth(fx - x0);
  const v = smooth(fy - y0);
  const at = (ix: number, iy: number): number => hash(wrap(ix, cells), wrap(iy, rows), salt);

  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * u;
  const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * u;
  return top + (bottom - top) * v;
}

/**
 * Octaves of value noise, each with twice the cells of the last, normalised back to [0, 1].
 * `rows` other than `cells` stretches it — a snowfield combed by the wind.
 */
export function fbm(
  x: number,
  y: number,
  period: number,
  cells: number,
  octaves: number,
  salt: number,
  rows = cells,
): number {
  let sum = 0;
  let weight = 1;
  let total = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += valueNoise(x, y, period, cells * 2 ** octave, salt + octave * 31, rows * 2 ** octave) * weight;
    total += weight;
    weight *= 0.5;
  }
  return sum / total;
}

export interface Point {
  x: number;
  y: number;
  /** A number in [0, 1) belonging to the point, for choosing what to put there. */
  pick: number;
}

/**
 * One point per square of a `step`-sized lattice, jittered inside it.
 *
 * A jittered lattice rather than points thrown at random: random points clump and leave holes,
 * and on a 64-texel tile a hole is a bald patch that repeats across the whole map. The jitter
 * stays inside the square, so two points are never closer than the gap the margin leaves.
 */
export function scatter(period: number, step: number, salt: number, keep = 1, margin = 0.15): Point[] {
  const across = Math.max(1, Math.round(period / step));
  // The square is stretched to divide the period exactly; a step that does not divide it would
  // leave the last column short and crowd two points together at the seam, on every repeat.
  const size = period / across;
  const points: Point[] = [];
  for (let row = 0; row < across; row += 1) {
    for (let column = 0; column < across; column += 1) {
      if (hash(column, row, salt + 7) >= keep) continue;
      const jx = margin + hash(column, row, salt) * (1 - margin * 2);
      const jy = margin + hash(column, row, salt + 1) * (1 - margin * 2);
      points.push({
        x: Math.floor((column + jx) * size),
        y: Math.floor((row + jy) * size),
        pick: hash(column, row, salt + 2),
      });
    }
  }
  return points;
}

export interface Cracks {
  /** Which site a texel belongs to. */
  site: Int32Array;
  /** Distance to the nearest site minus distance to the second: zero on a crack. */
  edge: Float64Array;
  /** How far each texel is from its own site, as a fraction of how far the cell reaches. */
  centre: Float64Array;
  /** Sites, so a caller can give each cell a value of its own. */
  sites: readonly Point[];
}

/**
 * A wrapped Voronoi diagram: dried mud, frost polygons, a slab of rock split along its joints.
 *
 * Measured against the nine copies of every site, so a cell that straddles the edge of the tile
 * is one cell rather than two halves with a crack down the seam.
 */
export function cracks(period: number, step: number, salt: number): Cracks {
  const sites = scatter(period, step, salt, 1, 0.1);
  const size = period * period;
  const site = new Int32Array(size);
  const edge = new Float64Array(size);
  const centre = new Float64Array(size);
  const reach = new Float64Array(sites.length);

  for (let y = 0; y < period; y += 1) {
    for (let x = 0; x < period; x += 1) {
      let first = Infinity;
      let second = Infinity;
      let owner = 0;
      for (const [index, point] of sites.entries()) {
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const d = Math.hypot(x + 0.5 - (point.x + 0.5 + ox * period), y + 0.5 - (point.y + 0.5 + oy * period));
            if (d < first) {
              second = first;
              first = d;
              owner = index;
            } else if (d < second) {
              second = d;
            }
          }
        }
      }
      const at = y * period + x;
      site[at] = owner;
      edge[at] = second - first;
      centre[at] = first;
      if (first > (reach[owner] ?? 0)) reach[owner] = first;
    }
  }

  for (let at = 0; at < size; at += 1) centre[at] = centre[at]! / (reach[site[at]!] || 1);
  return { site, edge, centre, sites };
}

/**
 * Replaces every value with its rank, so the result is spread evenly over [0, 1].
 *
 * A transition mask is read as "this texel goes over once the neighbour's strength passes my
 * value". If the values bunch up in the middle — and noise always does — the edge sits still
 * while the strength climbs and then lurches across in one step. Ranked, a strength of 0.2 turns
 * over exactly a fifth of the texels, which is what 0.2 is supposed to mean.
 */
export function equalize(values: Float64Array): Uint8Array {
  const order = Array.from(values.keys()).sort((a, b) => values[a]! - values[b]! || a - b);
  const out = new Uint8Array(values.length);
  const last = Math.max(1, values.length - 1);
  for (const [rank, index] of order.entries()) out[index] = Math.round((rank / last) * 255);
  return out;
}
