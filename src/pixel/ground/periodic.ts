
export const wrap = (value: number, period: number): number => ((value % period) + period) % period;

export function hash(x: number, y: number, salt: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

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
  pick: number;
}

export function scatter(period: number, step: number, salt: number, keep = 1, margin = 0.15): Point[] {
  const across = Math.max(1, Math.round(period / step));
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
  site: Int32Array;
  edge: Float64Array;
  centre: Float64Array;
  sites: readonly Point[];
}

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

export function equalize(values: Float64Array): Uint8Array {
  const order = Array.from(values.keys()).sort((a, b) => values[a]! - values[b]! || a - b);
  const out = new Uint8Array(values.length);
  const last = Math.max(1, values.length - 1);
  for (const [rank, index] of order.entries()) out[index] = Math.round((rank / last) * 255);
  return out;
}
