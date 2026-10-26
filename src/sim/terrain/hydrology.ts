import { noise2 } from '../rng.ts';
import type { FieldGrid } from './heightmap.ts';
import { cellX, cellY, SEA_LEVEL } from './heightmap.ts';

export const Water = { None: 0, Ocean: 1, Lake: 2 } as const;
export type Water = (typeof Water)[keyof typeof Water];

class LevelHeap {
  private readonly level: Float64Array;
  private readonly cell: Int32Array;
  private readonly entered: Int32Array;
  private count = 0;
  private entries = 0;

  constructor(capacity: number) {
    this.level = new Float64Array(capacity);
    this.cell = new Int32Array(capacity);
    this.entered = new Int32Array(capacity);
  }

  get size(): number {
    return this.count;
  }

  private before(a: number, b: number): boolean {
    const levelA = this.level[a]!;
    const levelB = this.level[b]!;
    if (levelA !== levelB) return levelA < levelB;
    return this.entered[a]! < this.entered[b]!;
  }

  private swap(a: number, b: number): void {
    const level = this.level[a]!;
    const cell = this.cell[a]!;
    const entered = this.entered[a]!;
    this.level[a] = this.level[b]!;
    this.cell[a] = this.cell[b]!;
    this.entered[a] = this.entered[b]!;
    this.level[b] = level;
    this.cell[b] = cell;
    this.entered[b] = entered;
  }

  push(level: number, cell: number): void {
    let at = this.count;
    this.level[at] = level;
    this.cell[at] = cell;
    this.entered[at] = this.entries;
    this.count += 1;
    this.entries += 1;

    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (!this.before(at, parent)) break;
      this.swap(at, parent);
      at = parent;
    }
  }

  pop(): number {
    const top = this.cell[0]!;
    this.count -= 1;
    if (this.count > 0) {
      this.swap(0, this.count);
      let at = 0;
      for (;;) {
        const left = at * 2 + 1;
        const right = left + 1;
        let best = at;
        if (left < this.count && this.before(left, best)) best = left;
        if (right < this.count && this.before(right, best)) best = right;
        if (best === at) break;
        this.swap(at, best);
        at = best;
      }
    }
    return top;
  }
}

const AROUND: readonly [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

const RISE = 2e-7;

const FLAT = 1e-4;

const LAKE_DEPTH = 0.006;

const RUMPLE = 0.0026;
const RUMPLE_CELLS = 5;

export function rumpled(grid: FieldGrid, height: Float32Array, seed: number, first = { column: 0, row: 0 }): Float32Array {
  const routing = new Float32Array(height.length);

  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const at = row * grid.columns + column;
      const wander = noise2((column + first.column) / RUMPLE_CELLS, (row + first.row) / RUMPLE_CELLS, seed + 9137) - 0.5;
      routing[at] = height[at]! + wander * 2 * RUMPLE;
    }
  }

  return routing;
}

const LAKE_CELLS = 4;

export interface Flow {
  ground: Float32Array;
  filled: Float32Array;
  sink: Uint8Array;
  into: Int32Array;
  water: Uint8Array;
  reached: Int32Array;
}

function floodOcean(grid: FieldGrid, height: Float32Array): Uint8Array {
  const { columns, rows } = grid;
  const water = new Uint8Array(columns * rows);
  const queue = new Int32Array(columns * rows);
  let head = 0;
  let tail = 0;

  const consider = (cell: number): void => {
    if (water[cell] !== Water.None || height[cell]! >= SEA_LEVEL) return;
    water[cell] = Water.Ocean;
    queue[tail] = cell;
    tail += 1;
  };

  for (let column = 0; column < columns; column += 1) {
    consider(column);
    consider((rows - 1) * columns + column);
  }
  for (let row = 0; row < rows; row += 1) {
    consider(row * columns);
    consider(row * columns + columns - 1);
  }

  while (head < tail) {
    const cell = queue[head]!;
    head += 1;
    const column = cell % columns;
    const row = (cell - column) / columns;
    for (const [dx, dy] of AROUND) {
      const c = column + dx;
      const r = row + dy;
      if (c < 0 || c >= columns || r < 0 || r >= rows) continue;
      consider(r * columns + c);
    }
  }

  return water;
}

export interface Boundary {
  ocean: Uint8Array;
  level: Float32Array;
}

export function resolveFlow(grid: FieldGrid, height: Float32Array, boundary?: Boundary): Flow {
  const count = grid.columns * grid.rows;
  const water = boundary ? Uint8Array.from(boundary.ocean) : floodOcean(grid, height);
  const filled = new Float32Array(count);
  const into = new Int32Array(count).fill(-1);
  const reached = new Int32Array(count);
  const seen = new Uint8Array(count);
  const heap = new LevelHeap(count);

  for (let cell = 0; cell < count; cell += 1) {
    if (water[cell] !== Water.Ocean) continue;
    filled[cell] = SEA_LEVEL;
    seen[cell] = 1;
    heap.push(SEA_LEVEL, cell);
  }

  if (boundary) {
    for (let cell = 0; cell < count; cell += 1) {
      const level = boundary.level[cell]!;
      if (water[cell] === Water.Ocean || Number.isNaN(level)) continue;
      filled[cell] = level;
      seen[cell] = 1;
      heap.push(level, cell);
    }
  }

  let found = 0;
  while (heap.size > 0) {
    const cell = heap.pop();
    reached[found] = cell;
    found += 1;

    const column = cell % grid.columns;
    const row = (cell - column) / grid.columns;
    const level = filled[cell]!;

    for (const [dx, dy] of AROUND) {
      const c = column + dx;
      const r = row + dy;
      if (c < 0 || c >= grid.columns || r < 0 || r >= grid.rows) continue;
      const next = r * grid.columns + c;
      if (seen[next] === 1) continue;

      seen[next] = 1;
      into[next] = cell;
      filled[next] = Math.max(height[next]!, level + RISE);
      heap.push(filled[next]!, next);
    }
  }

  markLakes(grid, height, filled, water);
  steepest(grid, height, filled, into);
  return { ground: height, filled, into, water, reached, sink: new Uint8Array(count) };
}

function steepest(
  grid: FieldGrid,
  height: Float32Array,
  filled: Float32Array,
  into: Int32Array,
): void {
  const count = grid.columns * grid.rows;

  for (let cell = 0; cell < count; cell += 1) {
    if (into[cell] === -1) continue;

    const column = cell % grid.columns;
    const row = (cell - column) / grid.columns;
    const here = filled[cell]!;
    let best = into[cell]!;
    let bestSlope = -Infinity;
    let flattest = Infinity;
    let onFlat = -1;

    for (const [dx, dy] of AROUND) {
      const c = column + dx;
      const r = row + dy;
      if (c < 0 || c >= grid.columns || r < 0 || r >= grid.rows) continue;
      const next = r * grid.columns + c;
      const drop = here - filled[next]!;
      const slope = drop / (dx === 0 || dy === 0 ? 1 : Math.SQRT2);
      if (slope > bestSlope) {
        bestSlope = slope;
        best = next;
      }

      if (drop > 0 && height[next]! < flattest) {
        flattest = height[next]!;
        onFlat = next;
      }
    }

    if (bestSlope < FLAT && onFlat >= 0) best = onFlat;

    into[cell] = best;
  }
}

function markLakes(
  grid: FieldGrid,
  height: Float32Array,
  filled: Float32Array,
  water: Uint8Array,
): void {
  const count = grid.columns * grid.rows;
  const deep = new Uint8Array(count);
  for (let cell = 0; cell < count; cell += 1) {
    if (water[cell] === Water.None && filled[cell]! - height[cell]! > LAKE_DEPTH) deep[cell] = 1;
  }

  const body = new Int32Array(count);
  const queue = new Int32Array(count);

  for (let start = 0; start < count; start += 1) {
    if (deep[start] !== 1 || body[start] === 1) continue;
    let head = 0;
    let tail = 0;
    queue[tail] = start;
    tail += 1;
    body[start] = 1;

    while (head < tail) {
      const cell = queue[head]!;
      head += 1;
      const column = cell % grid.columns;
      const row = (cell - column) / grid.columns;
      for (const [dx, dy] of AROUND) {
        const c = column + dx;
        const r = row + dy;
        if (c < 0 || c >= grid.columns || r < 0 || r >= grid.rows) continue;
        const next = r * grid.columns + c;
        if (deep[next] !== 1 || body[next] === 1) continue;
        body[next] = 1;
        queue[tail] = next;
        tail += 1;
      }
    }

    if (tail >= LAKE_CELLS) for (let i = 0; i < tail; i += 1) water[queue[i]!] = Water.Lake;
  }
}

const EVAPORATION = 0.8;

const RUNOFF_SHARE = 0.5;

export function dryLakes(
  grid: FieldGrid,
  flow: Flow,
  flux: Float32Array,
  temperature: Float32Array,
  pinned?: Uint8Array,
): number {
  const count = grid.columns * grid.rows;
  const seen = new Uint8Array(count);
  const body = new Int32Array(count);
  let emptied = 0;

  for (let start = 0; start < count; start += 1) {
    if (flow.water[start] !== Water.Lake || seen[start] === 1) continue;

    let head = 0;
    let tail = 0;
    body[tail] = start;
    tail += 1;
    seen[start] = 1;
    let inflow = 0;
    let warmth = 0;
    let fixed = false;

    while (head < tail) {
      const cell = body[head]!;
      head += 1;
      if (pinned && pinned[cell] === 1) fixed = true;
      if (flux[cell]! > inflow) inflow = flux[cell]!;
      warmth += Math.max(0, temperature[cell]!);

      const column = cell % grid.columns;
      const row = (cell - column) / grid.columns;
      for (const [dx, dy] of AROUND) {
        const c = column + dx;
        const r = row + dy;
        if (c < 0 || c >= grid.columns || r < 0 || r >= grid.rows) continue;
        const next = r * grid.columns + c;
        if (flow.water[next] !== Water.Lake || seen[next] === 1) continue;
        seen[next] = 1;
        body[tail] = next;
        tail += 1;
      }
    }

    inflow *= RUNOFF_SHARE;
    if (!fixed && inflow < warmth * EVAPORATION) {
      const cells = Array.from(body.subarray(0, tail)).sort((x, y) => flow.ground[x]! - flow.ground[y]! || x - y);
      let capacity = 0;
      let reach = -Infinity;
      for (const cell of cells) {
        capacity += EVAPORATION * Math.max(0, temperature[cell]!);
        if (capacity > inflow) break;
        reach = flow.ground[cell]!;
      }
      for (const cell of cells) {
        flow.sink[cell] = 1;
        if (reach >= SEA_LEVEL && flow.ground[cell]! <= reach) flow.filled[cell] = reach;
        else flow.water[cell] = Water.None;
      }
      emptied += 1;
    }
  }

  return emptied;
}

export function accumulate(flow: Flow, rain: Float32Array): Float32Array {
  const flux = Float32Array.from(rain);
  for (let cell = 0; cell < flux.length; cell += 1) if (flow.water[cell] === Water.Ocean) flux[cell] = 0;

  for (let i = flow.reached.length - 1; i >= 0; i -= 1) {
    const cell = flow.reached[i]!;
    const next = flow.into[cell]!;
    if (next < 0) continue;
    if (flow.water[cell] === Water.Ocean || flow.sink[cell] === 1) continue;
    flux[next] = flux[next]! + flux[cell]!;
  }

  return flux;
}

export const RIVER_FLUX = 800;

const NARROWEST = 0.5;
const WIDEST = 3.4;

export interface RiverSegment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  half: number;
}

export interface Rivers {
  of: Int32Array;
  segments: RiverSegment[];
  count: number;
}

const MEANDER = 1.9;
const MEANDER_WAVE = 13;

function centreOf(grid: FieldGrid, cell: number): { x: number; y: number } {
  const column = cell % grid.columns;
  return { x: cellX(grid, column), y: cellY(grid, (cell - column) / grid.columns) };
}

function meanderOf(grid: FieldGrid, cell: number, seed: number): { x: number; y: number } {
  const centre = centreOf(grid, cell);
  const u = centre.x / MEANDER_WAVE;
  const v = centre.y / MEANDER_WAVE;
  return {
    x: centre.x + (noise2(u, v, seed + 3301) - 0.5) * 2 * MEANDER,
    y: centre.y + (noise2(u, v, seed + 7717) - 0.5) * 2 * MEANDER,
  };
}

export function traceRivers(
  grid: FieldGrid,
  flow: Flow,
  flux: Float32Array,
  seed: number,
): Rivers {
  const count = grid.columns * grid.rows;
  const of = new Int32Array(count);
  const segments: RiverSegment[] = [];

  const isRiver = (cell: number): boolean =>
    flow.water[cell] === Water.None &&
    flow.sink[cell] !== 1 &&
    flux[cell]! >= RIVER_FLUX &&
    flow.into[cell]! >= 0;

  let next = 1;
  for (let i = 0; i < flow.reached.length; i += 1) {
    const cell = flow.reached[i]!;
    if (!isRiver(cell)) continue;

    const downstream = flow.into[cell]!;
    of[cell] = of[downstream] === 0 ? next : of[downstream]!;
    if (of[cell] === next) next += 1;
  }

  for (let cell = 0; cell < count; cell += 1) {
    if (of[cell] === 0) continue;

    const downstream = flow.into[cell]!;
    const from = meanderOf(grid, cell, seed);
    const to =
      flow.water[downstream] === Water.None
        ? meanderOf(grid, downstream, seed)
        : centreOf(grid, downstream);

    const half = Math.min(WIDEST, NARROWEST * Math.sqrt(flux[cell]! / RIVER_FLUX));
    segments.push({ ax: from.x, ay: from.y, bx: to.x, by: to.y, half });
  }

  return { of, segments, count: next - 1 };
}
