import { altitudeOf, classify, latitudesOf, moisture, precipitation, temperatures } from './climate.ts';
import { pointInPolygon } from '../geometry.ts';
import type { Vec2 } from '../geometry.ts';
import {
  baseHeights,
  cellAtPoint,
  cellColumn,
  cellRow,
  cellX,
  cellY,
  SEA_LEVEL,
  worldGrid as createWorldGrid,
} from './heightmap.ts';
import type { FieldGrid } from './heightmap.ts';
import { accumulate, dryLakes, resolveFlow, rumpled, traceRivers, Water } from './hydrology.ts';
import type { Rivers, RiverSegment } from './hydrology.ts';
import { Biome } from '../types.ts';
import type { Environment } from '../types.ts';

export interface WorldField {
  seed: number;
  grid: FieldGrid;
  height: Float32Array;
  surface: Float32Array;
  water: Uint8Array;
  into: Int32Array;
  temperature: Float32Array;
  wet: Float32Array;
  flux: Float32Array;
  biome: Uint8Array;
  rivers: Rivers;
  reaches: Map<number, RiverSegment[]>;
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

const REACH_BUCKET = 8;

const MARK_BUCKET = 60;

const bucketOf = (x: number, y: number): number =>
  (Math.floor(x / REACH_BUCKET) + 0x8000) * 0x10000 + (Math.floor(y / REACH_BUCKET) + 0x8000);

function bucketRivers(segments: readonly RiverSegment[]): Map<number, RiverSegment[]> {
  const reaches = new Map<number, RiverSegment[]>();

  for (const segment of segments) {
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
  const grid = createWorldGrid();
  const cellCount = grid.columns * grid.rows;

  const height = baseHeights(grid, seed);
  const flow = resolveFlow(grid, rumpled(grid, height, seed));
  const latitudes = latitudesOf(seed);
  const temperature = temperatures(grid, height, latitudes);
  const rain = precipitation(grid, height, temperature, latitudes, seed);
  let flux = accumulate(flow, rain);
  for (let round = 0; round < 3; round += 1) {
    if (dryLakes(grid, flow, flux, temperature) === 0) break;
    flux = accumulate(flow, rain);
  }

  const rivers = traceRivers(grid, flow, flux, seed);
  const wet = moisture(grid, rain, flow.water, rivers.of, flux);

  const biome = new Uint8Array(cellCount);
  for (let cell = 0; cell < cellCount; cell += 1) {
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

const built: WorldField[] = [];

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

function gapTo(segment: RiverSegment, x: number, y: number): number {
  const dx = segment.bx - segment.ax;
  const dy = segment.by - segment.ay;
  const along = dx * dx + dy * dy;
  const t = along === 0 ? 0 : Math.max(0, Math.min(1, ((x - segment.ax) * dx + (y - segment.ay) * dy) / along));
  const px = segment.ax + dx * t - x;
  const py = segment.ay + dy * t - y;
  return px * px + py * py;
}

export function inRiver(field: WorldField, point: Vec2): boolean {
  const bucket = field.reaches.get(bucketOf(point.x, point.y));
  if (!bucket) return false;

  for (const segment of bucket) {
    if (gapTo(segment, point.x, point.y) <= segment.half * segment.half) return true;
  }
  return false;
}

function gapToLine(ax: number, ay: number, bx: number, by: number, x: number, y: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const along = dx * dx + dy * dy;
  const t = along === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / along));
  const px = ax + dx * t - x;
  const py = ay + dy * t - y;
  return px * px + py * py;
}

function segmentsCross(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const side = (px: number, py: number, qx: number, qy: number, rx: number, ry: number): number =>
    Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
  const a = side(ax, ay, bx, by, cx, cy);
  const b = side(ax, ay, bx, by, dx, dy);
  const c = side(cx, cy, dx, dy, ax, ay);
  const d = side(cx, cy, dx, dy, bx, by);
  return a !== b && c !== d;
}

function gapBetween(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): number {
  if (segmentsCross(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  return Math.min(
    gapToLine(ax, ay, bx, by, cx, cy),
    gapToLine(ax, ay, bx, by, dx, dy),
    gapToLine(cx, cy, dx, dy, ax, ay),
    gapToLine(cx, cy, dx, dy, bx, by),
  );
}

export function crossesWater(field: WorldField, from: Vec2, to: Vec2): boolean {
  for (const segment of reachesIn(field, {
    minX: Math.min(from.x, to.x),
    minY: Math.min(from.y, to.y),
    maxX: Math.max(from.x, to.x),
    maxY: Math.max(from.y, to.y),
  })) {
    const gap = gapBetween(from.x, from.y, to.x, to.y, segment.ax, segment.ay, segment.bx, segment.by);
    if (gap <= segment.half * segment.half) return true;
  }

  const { grid } = field;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil((length * 2) / grid.spacing));
  for (let i = 0; i < steps; i += 1) {
    const t = (i + 0.5) / steps;
    const at = cellAtPoint(grid, { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
    if (field.water[at] !== Water.None) return true;
  }

  return false;
}

export function freshWaterIn(field: WorldField, site: Vec2, vertices: readonly Vec2[]): boolean {
  if (vertices.length < 3) return freshWaterNear(field, site, field.grid.spacing);

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

function freshAt(field: WorldField, point: Vec2): boolean {
  return field.water[cellAtPoint(field.grid, point)] === Water.Lake || inRiver(field, point);
}

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

function closestOn(segment: RiverSegment, x: number, y: number): Vec2 {
  const dx = segment.bx - segment.ax;
  const dy = segment.by - segment.ay;
  const along = dx * dx + dy * dy;
  const t = along === 0 ? 0 : Math.max(0, Math.min(1, ((x - segment.ax) * dx + (y - segment.ay) * dy) / along));
  return { x: segment.ax + dx * t, y: segment.ay + dy * t };
}

export function nearestFreshWater(field: WorldField, from: Vec2, reach = 2400): Vec2 | null {
  const column = Math.floor(from.x / MARK_BUCKET);
  const row = Math.floor(from.y / MARK_BUCKET);
  const rings = Math.ceil(reach / MARK_BUCKET);

  let best: Vec2 | null = null;
  let bestGap = Infinity;

  for (let ring = 0; ring <= rings; ring += 1) {
    for (let r = row - ring; r <= row + ring; r += 1) {
      for (let c = column - ring; c <= column + ring; c += 1) {
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

export function elevationAt(field: WorldField, point: Vec2): number {
  return between(field.grid, field.height, point);
}

export function environmentAt(field: WorldField, point: Vec2): Environment {
  return {
    elevation: elevationAt(field, point),
    temperature: Math.min(1, Math.max(0, (between(field.grid, field.temperature, point) + 25) / 60)),
    humidity: Math.min(1, Math.max(0, between(field.grid, field.wet, point) / 48)),
  };
}

export function biomeAt(field: WorldField, point: Vec2): Biome {
  const cell = cellAtPoint(field.grid, point);
  if (field.water[cell] === Water.None && inRiver(field, point)) return Biome.River;
  return ORDER[field.biome[cell]!] ?? Biome.Ocean;
}

export function groundAt(field: WorldField, point: Vec2): Biome {
  return ORDER[field.biome[cellAtPoint(field.grid, point)]!] ?? Biome.Ocean;
}

export function reachesIn(
  field: WorldField,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): RiverSegment[] {
  const firstX = Math.floor(bounds.minX / REACH_BUCKET);
  const lastX = Math.floor(bounds.maxX / REACH_BUCKET);
  const firstY = Math.floor(bounds.minY / REACH_BUCKET);
  const lastY = Math.floor(bounds.maxY / REACH_BUCKET);

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

export const isWater = (biome: Biome): boolean =>
  biome === Biome.Ocean || biome === Biome.Lake || biome === Biome.River;

export function waterCheck(biome: Biome): string | null {
  if (biome === Biome.Ocean) return 'open water';
  if (biome === Biome.Lake) return 'standing water';
  if (biome === Biome.River) return 'the river runs through here';
  return null;
}

export const isFresh = (biome: Biome): boolean => biome === Biome.Lake || biome === Biome.River;

export { altitudeOf, SEA_LEVEL };
