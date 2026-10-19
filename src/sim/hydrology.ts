import { cellX, cellY, SEA_LEVEL } from './heightmap.ts';
import type { FieldGrid } from './heightmap.ts';
import { noise2 } from './rng.ts';

/** What covers a cell of the field. Land is the absence of the other two. */
export const Water = { None: 0, Ocean: 1, Lake: 2 } as const;
export type Water = (typeof Water)[keyof typeof Water];

/**
 * A heap of cells ordered by the height water would have to reach to get there.
 *
 * Ties are broken by the order cells went in, never left to the heap's own arrangement: two
 * cells of exactly equal height are common on a filled plain, and whichever comes out first
 * decides which way the river runs. Left to chance that is a different map from the same seed.
 */
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

/** The eight neighbours of a cell, as column and row steps. Water takes the shortest way down. */
const AROUND: readonly [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/**
 * The step every cell is raised by above the one it drains into.
 *
 * Small enough that a chain thousands of cells long still rises by less than a lake is deep, so
 * a filled plain is not mistaken for standing water; large enough that the drop is never lost to
 * the gaps between floats, which would leave a cell with nowhere to send its water.
 */
const RISE = 2e-7;

/**
 * Below this, a slope is a flat.
 *
 * Real ground falls by a few thousandths of its range from one cell to the next; the fill rises
 * by `RISE`, which is five thousand times smaller again. Anything in between is noise, so the
 * gap between the two is wide and the test does not have to be delicate.
 */
const FLAT = 1e-4;

/** How much standing water a cell must hold before it is a lake rather than a filled hollow. */
const LAKE_DEPTH = 0.006;

/**
 * The wander put into the ground before the water is routed over it.
 *
 * Steepest descent down a smooth field runs dead straight: the slope points the same way for
 * tens of cells together, so the river does too, and a map of straight diagonal lines is the
 * one thing that gives a generated river away. A gentle rumple — far too small to see in the
 * ground, several cells across so it bends a course rather than dithering it — sends the water
 * wandering the way water wanders. The rumple is used for routing only; what is drawn, and what
 * the climate reads, is the ground itself.
 */
const RUMPLE = 0.0026;
const RUMPLE_CELLS = 5;

export function rumpled(grid: FieldGrid, height: Float32Array, seed: number): Float32Array {
  const routing = new Float32Array(height.length);

  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const at = row * grid.columns + column;
      const wander = noise2(column / RUMPLE_CELLS, row / RUMPLE_CELLS, seed + 9137) - 0.5;
      routing[at] = height[at]! + wander * 2 * RUMPLE;
    }
  }

  return routing;
}

/** Fewer cells than this is a puddle, and a puddle drawn as a lake is a speck of blue noise. */
const LAKE_CELLS = 4;

export interface Flow {
  /** The surface water rests on: the ground, or the lake standing over it. */
  filled: Float32Array;
  /**
   * Basins whose water never leaves: what runs in is lost to the sky. Empty until `dryLakes`
   * has had its say.
   */
  sink: Uint8Array;
  /** The neighbour this cell's water leaves by. -1 for the sea, which keeps what it is given. */
  into: Int32Array;
  water: Uint8Array;
  /** Cells lowest first — the order the flood reached them, so upstream always comes later. */
  reached: Int32Array;
}

/** The sea: everything below sea level that can be walked to from the edge of the world. */
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

/**
 * Fill every hollow until the whole of the land drains to the sea — Barnes' priority flood.
 *
 * The flood starts at sea level and climbs: a cell is reached over the lowest rim that leads to
 * it, and is raised to that rim if the ground is lower. So the pass answers three questions at
 * once that are usually asked separately — what the water surface is, which way each cell
 * drains (the neighbour the flood arrived from, which is by construction the way out), and
 * where the water stands deep enough to be a lake.
 *
 * Iterating "raise every cell above its lowest neighbour until nothing changes", the way the
 * obvious implementation does, is the same answer at tens of passes over the grid instead of one.
 */
export function resolveFlow(grid: FieldGrid, height: Float32Array): Flow {
  const count = grid.columns * grid.rows;
  const water = floodOcean(grid, height);
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
  return { filled, into, water, reached, sink: new Uint8Array(count) };
}

/**
 * Point every cell down its own steepest slope, rather than back the way the flood came.
 *
 * The flood arrives at a cell from whichever neighbour it happened to reach first, and on a
 * gentle slope that is the front of an expanding ring — so following it back draws a straight
 * radial line, and a map of straight rivers. The filled surface guarantees every cell a
 * neighbour strictly below it, so taking the steepest of them is both safe and what water
 * actually does. The order the flood found the cells in is still the right order to add their
 * water up in, because a cell's new neighbour is lower and so was reached earlier.
 */
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
    // The flood's own receiver is one of the eight and is strictly lower, so the sweep below
    // always beats this and `best` is never left as the one the flood happened to arrive from.
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

      // The bed under the fill, for the flats below. Only neighbours the flood reached before
      // this one are candidates: inside a flat the fill rises by a hair at every step, so a
      // lower *filled* value is exactly "reached earlier", and following it can never close a
      // loop however the ground wanders.
      if (drop > 0 && height[next]! < flattest) {
        flattest = height[next]!;
        onFlat = next;
      }
    }

    // A flat is drained by the ground under it, not by the fill on top.
    //
    // Fill a hollow and its surface is level to the last bit, so the only thing left to tell
    // one neighbour from another is the hair's breadth each was raised by as the flood passed
    // — which is a record of how the flood spread, not of the land. Steepest descent down that
    // runs dead straight out of the spill point, and a shallow basin comes out as a star of
    // straight rivers. The drowned ground still has its own slopes; water crossing a flooded
    // basin follows them, so the tie is broken on the bed.
    if (bestSlope < FLAT && onFlat >= 0) best = onFlat;

    into[cell] = best;
  }
}

/** Standing water: wherever the fill left the surface well above the ground under it. */
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

  // A lake is its whole body or none of it: a handful of cells here and there is the fill
  // catching a dimple in the ground, and drawn as water it comes out as blue grit on the map.
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

/**
 * How much water a cell of lake loses to the sky, per degree it stands above freezing.
 *
 * Tuned against the flux the rain model produces: a hundred cells of lake in a country at
 * twenty degrees need a decent stream running into them to stay wet.
 */
const EVAPORATION = 0.8;

/**
 * Empty the lakes nothing feeds.
 *
 * Filling every hollow to its brim puts a lake in every basin on the map, including the ones in
 * the middle of a desert where the rain that would fill them never falls — and a desert stippled
 * with blue is the single clearest sign that a map was filled by an algorithm rather than by
 * weather. A hollow with no river running into it and a hot sky over it is a dry basin, which is
 * what the real ones are. The drainage is untouched: water still runs through the hollow, it
 * just does not stand there.
 */
export function dryLakes(
  grid: FieldGrid,
  flow: Flow,
  flux: Float32Array,
  temperature: Float32Array,
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

    while (head < tail) {
      const cell = body[head]!;
      head += 1;
      // Water flows through a lake to its outlet, so the most any of its cells carries is the
      // whole of what runs in — no need to find the inlets to add them up.
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

    if (inflow < warmth * EVAPORATION) {
      // Dry, and a sink: whatever runs in goes up into the sky, which is what an endorheic
      // basin is. Leaving it to pass its water on was the same as pretending the lake is still
      // there — the river ran on out of the far side of a basin that holds nothing.
      for (let i = 0; i < tail; i += 1) {
        flow.water[body[i]!] = Water.None;
        flow.sink[body[i]!] = 1;
      }
      emptied += 1;
    }
  }

  return emptied;
}

/**
 * How much water passes through each cell: its own rain, plus everything the land above it
 * sends down. Worked out from the driest ground to the wettest by walking the flood's own order
 * backwards — a cell was reached before everything uphill of it, so in reverse every tributary
 * is counted before the river it joins.
 */
export function accumulate(flow: Flow, rain: Float32Array): Float32Array {
  const flux = Float32Array.from(rain);
  // The sea contributes nothing: rain that falls on it is already where it was going.
  for (let cell = 0; cell < flux.length; cell += 1) if (flow.water[cell] === Water.Ocean) flux[cell] = 0;

  for (let i = flow.reached.length - 1; i >= 0; i -= 1) {
    const cell = flow.reached[i]!;
    const next = flow.into[cell]!;
    if (next < 0) continue;
    // The sea keeps what it is given, and so does a basin with no way out.
    if (flow.water[cell] === Water.Ocean || flow.sink[cell] === 1) continue;
    flux[next] = flux[next]! + flux[cell]!;
  }

  return flux;
}

/** How much water a cell has to carry before it is a river and not a wet slope. */
export const RIVER_FLUX = 800;

/** Half-widths in world units: a creek the eye can just see, and the mouth of the longest river. */
const NARROWEST = 0.5;
const WIDEST = 3.4;

export interface RiverSegment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Half the river's width where it leaves `a`, in world units. */
  half: number;
}

export interface Rivers {
  /** Which river each cell belongs to, counted from 1. 0 is dry ground. */
  of: Int32Array;
  segments: RiverSegment[];
  count: number;
}

/**
 * How far a river wanders off the line its cells draw, in world units, and how far it runs
 * between one bend and the next.
 *
 * The chain of cells a river runs down can only point eight ways. On ground that falls smoothly
 * — which is most ground — steepest descent holds one of those eight for dozens of cells at a
 * time and then turns a corner, so the map comes out looking like a circuit board: long straight
 * runs meeting at right angles, with the grid's own axes showing through.
 *
 * The cure is a displacement *field* of world position rather than a number per cell. A per-cell
 * jitter is white noise: every point hops its own way, the line comes out furry, and a straight
 * run is still straight. Neighbouring cells read almost the same value out of a field, so the
 * whole chain leans one way and then the other — it bends instead of jittering. Two runs that
 * meet at a cell still meet, because they ask the same question about the same point.
 *
 * Kept under a cell: the displacement has to be smaller than the step between points, or a
 * strong gradient can push two points past each other and the line folds back on itself.
 */
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

/**
 * The rivers: every cell carrying enough water, strung into the runs between them.
 *
 * A run is drawn from the cell to the one it drains into, so the network is joined by
 * construction — confluences need no special case, because two cells draining into a third
 * simply both have a run that ends there.
 */
export function traceRivers(
  grid: FieldGrid,
  flow: Flow,
  flux: Float32Array,
  seed: number,
): Rivers {
  const count = grid.columns * grid.rows;
  const of = new Int32Array(count);
  const segments: RiverSegment[] = [];

  // A river is drawn on dry land that water runs *through*. The floor of a basin that holds
  // nothing is not that: the water arriving there is the end of the river, not a stretch of it,
  // and drawing the drainage across a dried-out basin is what painted straight rays over a flat.
  const isRiver = (cell: number): boolean =>
    flow.water[cell] === Water.None &&
    flow.sink[cell] !== 1 &&
    flux[cell]! >= RIVER_FLUX &&
    flow.into[cell]! >= 0;

  // Numbered from the mouths up, so a tributary takes the number of the river it joins and the
  // run of cells down to the sea is one river. The flood reached the mouth first, so walking its
  // order forwards always numbers the water below a cell before the cell itself.
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
    // Into water the river runs to the middle of the cell rather than to a wandered point: the
    // mouth has to reach the water, not stop a cell short of it.
    const to =
      flow.water[downstream] === Water.None
        ? meanderOf(grid, downstream, seed)
        : centreOf(grid, downstream);

    const half = Math.min(WIDEST, NARROWEST * Math.sqrt(flux[cell]! / RIVER_FLUX));
    segments.push({ ax: from.x, ay: from.y, bx: to.x, by: to.y, half });
  }

  return { of, segments, count: next - 1 };
}
