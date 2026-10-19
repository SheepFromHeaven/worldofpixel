import { altitudeOf, classify, latitudesOf, moisture, precipitation, temperatures } from './climate.ts';
import { pointInPolygon } from './geometry.ts';
import type { Vec2 } from './geometry.ts';
import {
  baseHeights,
  cellAtPoint,
  cellColumn,
  cellRow,
  cellX,
  cellY,
  SEA_LEVEL,
  worldGrid,
} from './heightmap.ts';
import type { FieldGrid } from './heightmap.ts';
import { accumulate, dryLakes, resolveFlow, rumpled, traceRivers, Water } from './hydrology.ts';
import type { Rivers, RiverSegment } from './hydrology.ts';
import { Biome } from './types.ts';
import type { Environment } from './types.ts';

/**
 * The world, worked out once.
 *
 * Everything before this file was a pure function of a point: ask for any spot on the map and
 * the noise told you what was there, with nothing generated in advance and nothing stored. That
 * cannot survive rivers. Where water goes at a point is decided by every slope above it — the
 * question "is there a river here" has no local answer — so the map is now *built*: one pass
 * over the whole world that resolves its hollows, runs its water to the sea and lets the weather
 * blow across it, kept behind a memo on the seed.
 *
 * What the rest of the program sees is unchanged, and so is the rule that matters: the field is
 * a pure function of the seed, the same seed gives the same world for ever, and the same lake
 * is in the same place however you arrive at it. Sampling it is now cheaper than the noise was.
 */
export interface WorldField {
  seed: number;
  grid: FieldGrid;
  /** The ground itself, 0..1, sea level at `SEA_LEVEL`. */
  height: Float32Array;
  /** What water rests on: the ground, or the lake standing over it. */
  surface: Float32Array;
  water: Uint8Array;
  /** The neighbouring cell each one's water leaves by: the drainage of the whole world. */
  into: Int32Array;
  /** Degrees Celsius. */
  temperature: Float32Array;
  /** How much the ground has to grow on, in the units the biome table is written in. */
  wet: Float32Array;
  /** How much water runs through a cell, which is what makes some of them rivers. */
  flux: Float32Array;
  biome: Uint8Array;
  rivers: Rivers;
  /** River runs, bucketed on a coarse grid so a point can ask what water it is standing in. */
  reaches: Map<number, RiverSegment[]>;
  /** One scrap of fresh water per wide bucket, for asking which way the nearest water lies. */
  marks: Map<number, Vec2>;
}

const ORDER: readonly Biome[] = [
  Biome.Meadow,
  Biome.Forest,
  Biome.Highland,
  Biome.Marsh,
  Biome.Tundra,
  Biome.Desert,
  Biome.Ocean,
  Biome.Lake,
  Biome.River,
];

const INDEX_OF: Record<Biome, number> = {
  [Biome.Meadow]: 0,
  [Biome.Forest]: 1,
  [Biome.Highland]: 2,
  [Biome.Marsh]: 3,
  [Biome.Tundra]: 4,
  [Biome.Desert]: 5,
  [Biome.Ocean]: 6,
  [Biome.Lake]: 7,
  [Biome.River]: 8,
};

/** How wide a bucket of river runs is. A run is at most a cell long and a few units wide. */
const REACH_BUCKET = 8;

/**
 * How wide a bucket of the "where is the nearest water" index is.
 *
 * Much coarser than the runs themselves, and one point kept per bucket rather than all of them.
 * The question it answers is asked by the ledger, which turns it into "two hundred paces
 * north-east" — so an answer good to sixty units is as good as an exact one, and the index is a
 * few thousand entries rather than a few hundred thousand.
 */
const MARK_BUCKET = 60;

const bucketOf = (x: number, y: number): number =>
  (Math.floor(x / REACH_BUCKET) + 0x8000) * 0x10000 + (Math.floor(y / REACH_BUCKET) + 0x8000);

function bucketRivers(segments: readonly RiverSegment[]): Map<number, RiverSegment[]> {
  const reaches = new Map<number, RiverSegment[]>();

  for (const segment of segments) {
    // Filed under every bucket the run can reach into, so a point only ever has to look in the
    // one bucket it stands in.
    const minX = Math.min(segment.ax, segment.bx) - segment.half;
    const maxX = Math.max(segment.ax, segment.bx) + segment.half;
    const minY = Math.min(segment.ay, segment.by) - segment.half;
    const maxY = Math.max(segment.ay, segment.by) + segment.half;

    for (let y = Math.floor(minY / REACH_BUCKET); y <= Math.floor(maxY / REACH_BUCKET); y += 1) {
      for (let x = Math.floor(minX / REACH_BUCKET); x <= Math.floor(maxX / REACH_BUCKET); x += 1) {
        const key = (x + 0x8000) * 0x10000 + (y + 0x8000);
        const bucket = reaches.get(key);
        if (bucket) bucket.push(segment);
        else reaches.set(key, [segment]);
      }
    }
  }

  return reaches;
}

/** One scrap of fresh water per wide bucket: the first one found, so it is a function of the seed. */
function markWater(grid: FieldGrid, water: Uint8Array, segments: readonly RiverSegment[]): Map<number, Vec2> {
  const marks = new Map<number, Vec2>();

  const mark = (point: Vec2): void => {
    const key =
      (Math.floor(point.x / MARK_BUCKET) + 0x8000) * 0x10000 +
      (Math.floor(point.y / MARK_BUCKET) + 0x8000);
    if (!marks.has(key)) marks.set(key, point);
  };

  for (const segment of segments) mark({ x: segment.ax, y: segment.ay });
  for (let cell = 0; cell < water.length; cell += 1) {
    if (water[cell] !== Water.Lake) continue;
    const column = cell % grid.columns;
    mark({ x: cellX(grid, column), y: cellY(grid, (cell - column) / grid.columns) });
  }

  return marks;
}

export function buildField(seed: number): WorldField {
  const grid = worldGrid();
  const count = grid.columns * grid.rows;

  const height = baseHeights(grid, seed);
  const flow = resolveFlow(grid, rumpled(grid, height, seed));
  const latitudes = latitudesOf(seed);
  const temperature = temperatures(grid, height, latitudes);
  const rain = precipitation(grid, height, temperature, latitudes, seed);
  // Water, lakes and the lakes that dry out, settled together.
  //
  // Which basins hold water depends on how much runs into them, and how much runs into the next
  // one down depends on which of the ones above it dried — so the two have to be asked in turn
  // until they stop changing. Twice is almost always enough; three times is the cap, because a
  // chain of basins each only just holding on is not worth another sweep of the world.
  let flux = accumulate(flow, rain);
  for (let round = 0; round < 3; round += 1) {
    if (dryLakes(grid, flow, flux, temperature) === 0) break;
    flux = accumulate(flow, rain);
  }

  const rivers = traceRivers(grid, flow, flux, seed);
  const wet = moisture(grid, rain, flow.water, rivers.of, flux);

  const biome = new Uint8Array(count);
  for (let cell = 0; cell < count; cell += 1) {
    if (flow.water[cell] === Water.Ocean) biome[cell] = INDEX_OF[Biome.Ocean];
    else if (flow.water[cell] === Water.Lake) biome[cell] = INDEX_OF[Biome.Lake];
    else {
      biome[cell] = INDEX_OF[
        classify(height[cell]!, temperature[cell]!, wet[cell]!, rivers.of[cell] !== 0)
      ];
    }
  }

  return {
    seed,
    grid,
    height,
    surface: flow.filled,
    water: flow.water,
    into: flow.into,
    temperature,
    wet,
    flux,
    biome,
    rivers,
    reaches: bucketRivers(rivers.segments),
    marks: markWater(grid, flow.water, rivers.segments),
  };
}

/**
 * The last couple of worlds built.
 *
 * Two, not one: rolling a new map and going back to the old one is a thing people do, and a
 * world costs a tenth of a second to build. More than two is holding several megabytes of
 * country nobody is looking at.
 */
const built: WorldField[] = [];

/**
 * Take a world that was worked out somewhere else — a worker thread — as though it had been
 * built here.
 *
 * The whole field is reachable only through `fieldFor`, and everything that asks for it does so
 * synchronously from deep inside the simulation. Rather than make all of that async for the sake
 * of one call at startup, the thread that can afford to wait builds the world and leaves it in
 * the memo; by the time anything asks, the answer is already there.
 */
export function installField(field: WorldField): void {
  built.unshift(field);
  if (built.length > 2) built.length = 2;
}

export function fieldFor(seed: number): WorldField {
  const known = built.find((field) => field.seed === seed);
  if (known) return known;

  const field = buildField(seed);
  built.unshift(field);
  if (built.length > 2) built.length = 2;
  return field;
}

/** A value read between the four cells around a point, so the ground is not a staircase. */
function between(grid: FieldGrid, values: Float32Array, point: Vec2): number {
  const fx = (point.x - grid.minX) / grid.spacing - 0.5;
  const fy = (point.y - grid.minY) / grid.spacing - 0.5;
  const column = Math.floor(fx);
  const row = Math.floor(fy);
  const u = fx - column;
  const v = fy - row;

  const clampColumn = (c: number): number => (c < 0 ? 0 : c >= grid.columns ? grid.columns - 1 : c);
  const clampRow = (r: number): number => (r < 0 ? 0 : r >= grid.rows ? grid.rows - 1 : r);

  const left = clampColumn(column);
  const right = clampColumn(column + 1);
  const top = clampRow(row) * grid.columns;
  const bottom = clampRow(row + 1) * grid.columns;

  const above = values[top + left]! + (values[top + right]! - values[top + left]!) * u;
  const below = values[bottom + left]! + (values[bottom + right]! - values[bottom + left]!) * u;
  return above + (below - above) * v;
}

/** Distance from a point to a run of river, squared. */
function gapTo(segment: RiverSegment, x: number, y: number): number {
  const dx = segment.bx - segment.ax;
  const dy = segment.by - segment.ay;
  const along = dx * dx + dy * dy;
  const t = along === 0 ? 0 : Math.max(0, Math.min(1, ((x - segment.ax) * dx + (y - segment.ay) * dy) / along));
  const px = segment.ax + dx * t - x;
  const py = segment.ay + dy * t - y;
  return px * px + py * py;
}

/**
 * Whether a point is in the water of a river, and how far from its bank.
 *
 * The same test the ground is painted with, which is the point of it: a parcel counts as river
 * exactly when the river is drawn over its site, so what you can see and what you can build on
 * can never disagree. A creek narrower than the gap between two sites therefore blocks nothing,
 * and is drawn all the same.
 */
export function inRiver(field: WorldField, point: Vec2): boolean {
  const bucket = field.reaches.get(bucketOf(point.x, point.y));
  if (!bucket) return false;

  for (const segment of bucket) {
    if (gapTo(segment, point.x, point.y) <= segment.half * segment.half) return true;
  }
  return false;
}

/**
 * Whether fresh water is *in* a tile: the one thing a well asks of the ground.
 *
 * The parcel, not a circle round its middle. A Voronoi cell is convex, so a run of river crosses
 * it exactly when the point of that run nearest the site falls inside it — and when the run
 * passes just outside, the water still reaches in if the bank on the cell's side does. Those two
 * tests are the whole of it, and they are the same ribbon the painter fills, so a tile the river
 * is drawn across is a tile a well works on.
 *
 * A parcel's site being in the water means the parcel is water, and nothing is built there at
 * all. So in practice this is the test for the bank: the tile the river crosses without
 * drowning its middle.
 */
export function freshWaterIn(field: WorldField, site: Vec2, vertices: readonly Vec2[]): boolean {
  if (vertices.length < 3) return freshWaterNear(field, site, field.grid.spacing);

  // The corners first, and the middles of the edges with them. Water does not have to reach the
  // middle of a tile to be in it — a lake that takes one corner is in the tile, and that is what
  // the eye reads long before it works out where the site is. A corner belongs to the three
  // cells that meet there, so water on it is water in all three, which is also right.
  for (let i = 0; i < vertices.length; i += 1) {
    const corner = vertices[i]!;
    const next = vertices[(i + 1) % vertices.length]!;
    if (freshAt(field, corner)) return true;
    if (freshAt(field, { x: (corner.x + next.x) / 2, y: (corner.y + next.y) / 2 })) return true;
  }

  let reach = 0;
  for (const vertex of vertices) {
    const gap = Math.hypot(vertex.x - site.x, vertex.y - site.y);
    if (gap > reach) reach = gap;
  }

  for (const segment of reachesAround(field, site, reach)) {
    const near = closestOn(segment, site.x, site.y);
    if (pointInPolygon(near, vertices)) return true;

    // The centre line misses the tile, so the water reaches in only if the bank on this side
    // does: step from that nearest point toward the site by the river's own half-width.
    const away = Math.hypot(site.x - near.x, site.y - near.y);
    if (away === 0 || away > reach + segment.half) continue;
    const bank = {
      x: near.x + ((site.x - near.x) / away) * segment.half,
      y: near.y + ((site.y - near.y) / away) * segment.half,
    };
    if (pointInPolygon(bank, vertices)) return true;
  }

  const { grid } = field;
  const first = cellColumn(grid, site.x - reach);
  const last = cellColumn(grid, site.x + reach);
  const top = cellRow(grid, site.y - reach);
  const bottom = cellRow(grid, site.y + reach);

  for (let row = top; row <= bottom; row += 1) {
    for (let column = first; column <= last; column += 1) {
      if (field.water[row * grid.columns + column] !== Water.Lake) continue;
      if (pointInPolygon({ x: cellX(grid, column), y: cellY(grid, row) }, vertices)) return true;
    }
  }

  return false;
}

/** Whether a point is standing in fresh water: a lake's cell, or a river's ribbon. */
function freshAt(field: WorldField, point: Vec2): boolean {
  return field.water[cellAtPoint(field.grid, point)] === Water.Lake || inRiver(field, point);
}

/** The runs of river that could come within `reach` of a point. */
function reachesAround(field: WorldField, point: Vec2, reach: number): RiverSegment[] {
  const found: RiverSegment[] = [];
  const firstX = Math.floor((point.x - reach) / REACH_BUCKET);
  const lastX = Math.floor((point.x + reach) / REACH_BUCKET);
  const firstY = Math.floor((point.y - reach) / REACH_BUCKET);
  const lastY = Math.floor((point.y + reach) / REACH_BUCKET);

  for (let y = firstY; y <= lastY; y += 1) {
    for (let x = firstX; x <= lastX; x += 1) {
      const bucket = field.reaches.get((x + 0x8000) * 0x10000 + (y + 0x8000));
      if (bucket) for (const segment of bucket) if (!found.includes(segment)) found.push(segment);
    }
  }

  return found;
}

/** The point of a run nearest somewhere, which for a convex cell decides whether it crosses. */
function closestOn(segment: RiverSegment, x: number, y: number): Vec2 {
  const dx = segment.bx - segment.ax;
  const dy = segment.by - segment.ay;
  const along = dx * dx + dy * dy;
  const t = along === 0 ? 0 : Math.max(0, Math.min(1, ((x - segment.ax) * dx + (y - segment.ay) * dy) / along));
  return { x: segment.ax + dx * t, y: segment.ay + dy * t };
}

/**
 * The nearest fresh water to a point, for telling the player which way to walk.
 *
 * Searched in rings out from where the asking is done, and stopped one ring after the first
 * water is found — the ring that contains the answer can still have a nearer one in its corner.
 * Scanning every run of river and every cell of lake instead is a sweep of the whole world, and
 * the ledger asks this several times a second.
 */
export function nearestFreshWater(field: WorldField, from: Vec2, reach = 2400): Vec2 | null {
  const column = Math.floor(from.x / MARK_BUCKET);
  const row = Math.floor(from.y / MARK_BUCKET);
  const rings = Math.ceil(reach / MARK_BUCKET);

  let best: Vec2 | null = null;
  let bestGap = Infinity;

  for (let ring = 0; ring <= rings; ring += 1) {
    for (let r = row - ring; r <= row + ring; r += 1) {
      for (let c = column - ring; c <= column + ring; c += 1) {
        // Only the edge of each ring: everything inside it was searched by a smaller one.
        if (ring > 0 && r !== row - ring && r !== row + ring && c !== column - ring && c !== column + ring) {
          continue;
        }
        const mark = field.marks.get((c + 0x8000) * 0x10000 + (r + 0x8000));
        if (!mark) continue;
        const gap = (mark.x - from.x) ** 2 + (mark.y - from.y) ** 2;
        if (gap < bestGap) {
          bestGap = gap;
          best = mark;
        }
      }
    }

    if (best) return best;
  }

  return best;
}

/** Fresh water within reach of a point: a river run or a lake. Never the sea. */
export function freshWaterNear(field: WorldField, point: Vec2, reach: number): boolean {
  const bucketMinX = Math.floor((point.x - reach) / REACH_BUCKET);
  const bucketMaxX = Math.floor((point.x + reach) / REACH_BUCKET);
  const bucketMinY = Math.floor((point.y - reach) / REACH_BUCKET);
  const bucketMaxY = Math.floor((point.y + reach) / REACH_BUCKET);

  for (let y = bucketMinY; y <= bucketMaxY; y += 1) {
    for (let x = bucketMinX; x <= bucketMaxX; x += 1) {
      const bucket = field.reaches.get((x + 0x8000) * 0x10000 + (y + 0x8000));
      if (!bucket) continue;
      for (const segment of bucket) {
        const edge = segment.half + reach;
        if (gapTo(segment, point.x, point.y) <= edge * edge) return true;
      }
    }
  }

  const { grid } = field;
  const first = cellColumn(grid, point.x - reach);
  const last = cellColumn(grid, point.x + reach);
  const top = cellRow(grid, point.y - reach);
  const bottom = cellRow(grid, point.y + reach);

  for (let row = top; row <= bottom; row += 1) {
    for (let column = first; column <= last; column += 1) {
      if (field.water[row * grid.columns + column] !== Water.Lake) continue;
      const dx = cellX(grid, column) - point.x;
      const dy = cellY(grid, row) - point.y;
      if (dx * dx + dy * dy <= reach * reach) return true;
    }
  }

  return false;
}

/** How deep the sea is here, or how high the ground stands — 0..1, sea level at `SEA_LEVEL`. */
export function elevationAt(field: WorldField, point: Vec2): number {
  return between(field.grid, field.height, point);
}

export function environmentAt(field: WorldField, point: Vec2): Environment {
  return {
    elevation: elevationAt(field, point),
    // Back into the 0..1 the rest of the game reads these in. The field keeps degrees and the
    // biome table's own units, because a model written in made-up units cannot be checked
    // against anything, and this is where the translation belongs.
    temperature: Math.min(1, Math.max(0, (between(field.grid, field.temperature, point) + 25) / 60)),
    humidity: Math.min(1, Math.max(0, between(field.grid, field.wet, point) / 48)),
  };
}

/**
 * What a point is standing on.
 *
 * The cell, not the interpolation: a biome is a decision about a patch of ground and the one
 * thing it must never do is disagree with itself between two ways of asking. Rivers are the
 * exception, and have to be — they are narrower than a cell.
 */
export function biomeAt(field: WorldField, point: Vec2): Biome {
  const cell = cellAtPoint(field.grid, point);
  if (field.water[cell] === Water.None && inRiver(field, point)) return Biome.River;
  return ORDER[field.biome[cell]!] ?? Biome.Ocean;
}

/**
 * What the ground under a point is, with the rivers taken off it.
 *
 * The painter wants this and the rules want `biomeAt`. A river is drawn as a ribbon over the
 * ground, not as a cell of water: a stream a third of a parcel wide would otherwise flood its
 * whole Voronoi cell with blue and come out as a chain of ponds. The ribbon is what says where
 * the water is, and it is the same ribbon the rules test against.
 */
export function groundAt(field: WorldField, point: Vec2): Biome {
  return ORDER[field.biome[cellAtPoint(field.grid, point)]!] ?? Biome.Ocean;
}

/** Every run of river that could reach into a rectangle of the world. */
export function reachesIn(
  field: WorldField,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): RiverSegment[] {
  const firstX = Math.floor(bounds.minX / REACH_BUCKET);
  const lastX = Math.floor(bounds.maxX / REACH_BUCKET);
  const firstY = Math.floor(bounds.minY / REACH_BUCKET);
  const lastY = Math.floor(bounds.maxY / REACH_BUCKET);

  // A chunk at the widest zoom is two thousand units across, which is a quarter of a million
  // buckets to look in for a few thousand runs of river. Past the point where there are more
  // buckets than rivers, reading the rivers is the cheaper question.
  if ((lastX - firstX + 1) * (lastY - firstY + 1) > field.rivers.segments.length) {
    return field.rivers.segments.filter(
      (segment) =>
        Math.min(segment.ax, segment.bx) - segment.half <= bounds.maxX &&
        Math.max(segment.ax, segment.bx) + segment.half >= bounds.minX &&
        Math.min(segment.ay, segment.by) - segment.half <= bounds.maxY &&
        Math.max(segment.ay, segment.by) + segment.half >= bounds.minY,
    );
  }

  const found = new Set<RiverSegment>();
  for (let y = firstY; y <= lastY; y += 1) {
    for (let x = firstX; x <= lastX; x += 1) {
      const bucket = field.reaches.get((x + 0x8000) * 0x10000 + (y + 0x8000));
      if (bucket) for (const segment of bucket) found.add(segment);
    }
  }

  return [...found];
}

/**
 * The standing water, as the grid it was worked out on.
 *
 * Handed over whole rather than asked about a point at a time, which is the only way the
 * painter can use it: it wants to know about a quarter of a million points per chunk, and a
 * call that looks the world up by its seed and allocates a point for each of them costs more
 * than the rest of the bake. Nothing here is copied — these are the field's own arrays, and
 * whoever holds them must not write to them.
 */
export interface WaterSheet {
  grid: FieldGrid;
  water: Uint8Array;
  height: Float32Array;
}

export const waterSheetFor = (field: WorldField): WaterSheet => ({
  grid: field.grid,
  water: field.water,
  height: field.height,
});

/** Whether anything can stand here: the sea, a lake and a river are all out. */
export const isWater = (biome: Biome): boolean =>
  biome === Biome.Ocean || biome === Biome.Lake || biome === Biome.River;

/**
 * Why nothing can be put on this ground, in the words the cursor says it in — or null, which
 * means dry land. One sentence per kind of water, because "open water" over a stream reads as
 * the game having lost track of where the sea is.
 */
export function waterCheck(biome: Biome): string | null {
  if (biome === Biome.Ocean) return 'open water';
  if (biome === Biome.Lake) return 'standing water';
  if (biome === Biome.River) return 'the river runs through here';
  return null;
}

/** Fresh water, as against the sea — the kind a town can draw on. */
export const isFresh = (biome: Biome): boolean => biome === Biome.Lake || biome === Biome.River;

export { altitudeOf, SEA_LEVEL };
