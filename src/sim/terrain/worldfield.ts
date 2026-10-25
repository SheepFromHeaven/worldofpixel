import type { Vec2 } from '../geometry.ts';
import type { TileGrid } from '../grid.ts';
import { noise2 } from '../rng.ts';
import type { Environment } from '../types.ts';
import { Biome } from '../types.ts';
import { altitudeOf, classify, latitudesOf, moisture, precipitation, prevailing, temperatures } from './climate.ts';
import type { Weather } from './weather.ts';
import { weatherOf } from './weather.ts';
import { winds } from './wind.ts';
import { baseHeights, SEA_LEVEL, worldGrid } from './heightmap.ts';
import type { Rivers, RiverSegment } from './hydrology.ts';
import { accumulate, dryLakes, resolveFlow, rumpled, traceRivers, Water } from './hydrology.ts';

export interface WorldField {
  seed: number;
  grid: TileGrid;
  height: Float32Array;
  surface: Float32Array;
  water: Uint8Array;
  into: Int32Array;
  temperature: Float32Array;
  wet: Float32Array;
  flux: Float32Array;
  biome: Uint8Array;
  wind: Uint8Array;
  weather: Weather;
  prevailing: 1 | -1;
  rivers: Rivers;
  reaches: Map<number, RiverSegment[]>;
  marks: Map<number, Vec2>;
}

const REACH_BUCKET = 8;

const MARK_BUCKET = 16;

const keyOf = (x: number, y: number): number => (x + 0x8000) * 0x10000 + (y + 0x8000);

const bucketOf = (x: number, y: number): number =>
  keyOf(Math.floor(x / REACH_BUCKET), Math.floor(y / REACH_BUCKET));

function bucketRivers(segments: readonly RiverSegment[]): Map<number, RiverSegment[]> {
  const reaches = new Map<number, RiverSegment[]>();

  for (const segment of segments) {
    const minX = Math.min(segment.ax, segment.bx) - segment.half;
    const maxX = Math.max(segment.ax, segment.bx) + segment.half;
    const minY = Math.min(segment.ay, segment.by) - segment.half;
    const maxY = Math.max(segment.ay, segment.by) + segment.half;

    for (let y = Math.floor(minY / REACH_BUCKET); y <= Math.floor(maxY / REACH_BUCKET); y += 1) {
      for (let x = Math.floor(minX / REACH_BUCKET); x <= Math.floor(maxX / REACH_BUCKET); x += 1) {
        const bucket = reaches.get(keyOf(x, y));
        if (bucket) bucket.push(segment);
        else reaches.set(keyOf(x, y), [segment]);
      }
    }
  }

  return reaches;
}

function markWater(
  grid: TileGrid,
  water: Uint8Array,
  segments: readonly RiverSegment[],
): Map<number, Vec2> {
  const marks = new Map<number, Vec2>();

  const mark = (point: Vec2): void => {
    const key = keyOf(Math.floor(point.x / MARK_BUCKET), Math.floor(point.y / MARK_BUCKET));
    if (!marks.has(key)) marks.set(key, point);
  };

  for (const segment of segments) mark({ x: segment.ax, y: segment.ay });
  for (let cell = 0; cell < water.length; cell += 1) {
    if (water[cell] !== Water.Lake) continue;
    mark(grid.centre(cell));
  }

  return marks;
}

const WARP_LOBE = 47;
const WARP_WAVE = 13;
const WARP_FINE = 2.9;
const WARP_REACH = 5.5;

function wanderOf(x: number, y: number, seed: number): number {
  const lobe = noise2(x / WARP_LOBE, y / WARP_LOBE, seed) - 0.5;
  const broad = noise2(x / WARP_WAVE, y / WARP_WAVE, seed + 7919) - 0.5;
  const fine = noise2(x / WARP_FINE, y / WARP_FINE, seed + 104_729) - 0.5;
  return (lobe * 0.46 + broad * 0.34 + fine * 0.2) * 2 * WARP_REACH;
}

export function wanderEdges(grid: TileGrid, biome: Uint8Array, seed: number): Uint8Array {
  const out = new Uint8Array(biome.length);

  for (let row = 0; row < grid.rows; row += 1) {
    const y = grid.y(row);
    const at = row * grid.columns;

    for (let column = 0; column < grid.columns; column += 1) {
      const here = biome[at + column]!;
      if (here === Biome.Ocean || here === Biome.Lake) {
        out[at + column] = here;
        continue;
      }

      const x = grid.x(column);
      const found =
        biome[
          grid.atPoint({
            x: x + wanderOf(x, y, seed + 1301),
            y: y + wanderOf(x, y, seed + 1319),
          })
        ]!;

      out[at + column] = found === Biome.Ocean || found === Biome.Lake ? here : found;
    }
  }

  return out;
}

export function classifyAll(
  grid: TileGrid,
  water: Uint8Array,
  height: Float32Array,
  temperature: Float32Array,
  wet: Float32Array,
  river: Int32Array,
): Uint8Array {
  const classed = new Uint8Array(grid.count);
  for (let cell = 0; cell < grid.count; cell += 1) {
    if (water[cell] === Water.Ocean) classed[cell] = Biome.Ocean;
    else if (water[cell] === Water.Lake) classed[cell] = Biome.Lake;
    else classed[cell] = classify(height[cell]!, temperature[cell]!, wet[cell]!, river[cell] !== 0);
  }
  return classed;
}

export interface FieldProgress {
  label: string;
  share: number;
  grid: TileGrid;
  height?: Float32Array;
  water?: Uint8Array;
  biome?: Uint8Array;
}

export function* fieldSteps(seed: number): Generator<FieldProgress, WorldField, void> {
  const grid = worldGrid();

  const height = baseHeights(grid, seed);
  yield { label: 'raising the land', share: 0.15, grid, height };

  const flow = resolveFlow(grid, rumpled(grid, height, seed));
  yield { label: 'filling the seas', share: 0.35, grid, height, water: flow.water };

  const latitudes = latitudesOf(seed);
  const temperature = temperatures(grid, height, latitudes);
  const rain = precipitation(grid, height, temperature, latitudes, seed);
  yield { label: 'sending the rain', share: 0.5, grid, height, water: flow.water };

  let flux = accumulate(flow, rain);
  for (let round = 0; round < 3; round += 1) {
    if (dryLakes(grid, flow, flux, temperature) === 0) break;
    flux = accumulate(flow, rain);
  }

  const rivers = traceRivers(grid, flow, flux, seed);
  yield { label: 'cutting the rivers', share: 0.7, grid, height, water: flow.water };

  const wet = moisture(grid, rain, flow.water, rivers.of, flux);

  const wind = winds(grid, height, flow.water, latitudes);
  yield { label: 'raising the winds', share: 0.82, grid, height, water: flow.water };

  const classed = classifyAll(grid, flow.water, height, temperature, wet, rivers.of);
  const biome = wanderEdges(grid, classed, seed);
  yield { label: 'sowing the ground', share: 0.95, grid, height, water: flow.water, biome };

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
    wind,
    weather: weatherOf(grid, wet, temperature, wind, height, flow.water, latitudes),
    prevailing: prevailing(latitudes),
    rivers,
    reaches: bucketRivers(rivers.segments),
    marks: markWater(grid, flow.water, rivers.segments),
  };
}

export function buildField(seed: number): WorldField {
  const steps = fieldSteps(seed);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}

export async function buildFieldStaged(
  seed: number,
  report: (progress: FieldProgress) => Promise<void>,
): Promise<WorldField> {
  const known = built.find((field) => field.seed === seed);
  if (known) return known;

  const steps = fieldSteps(seed);
  for (;;) {
    const step = steps.next();
    if (step.done) {
      installField(step.value);
      return step.value;
    }
    await report(step.value);
  }
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
  installField(field);
  return field;
}

function between(grid: TileGrid, values: Float32Array, point: Vec2): number {
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

export function gapTo(segment: RiverSegment, x: number, y: number): number {
  const dx = segment.bx - segment.ax;
  const dy = segment.by - segment.ay;
  const along = dx * dx + dy * dy;
  const t =
    along === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - segment.ax) * dx + (y - segment.ay) * dy) / along));
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

export function nearestFreshWater(field: WorldField, from: Vec2, reach = 600): Vec2 | null {
  const column = Math.floor(from.x / MARK_BUCKET);
  const row = Math.floor(from.y / MARK_BUCKET);
  const rings = Math.ceil(reach / MARK_BUCKET);

  let best: Vec2 | null = null;
  let bestGap = Infinity;

  for (let ring = 0; ring <= rings; ring += 1) {
    for (let r = row - ring; r <= row + ring; r += 1) {
      for (let c = column - ring; c <= column + ring; c += 1) {
        const onRing =
          ring === 0 || r === row - ring || r === row + ring || c === column - ring || c === column + ring;
        if (!onRing) continue;
        const mark = field.marks.get(keyOf(c, r));
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
      const bucket = field.reaches.get(keyOf(x, y));
      if (!bucket) continue;
      for (const segment of bucket) {
        const edge = segment.half + reach;
        if (gapTo(segment, point.x, point.y) <= edge * edge) return true;
      }
    }
  }

  const { grid } = field;
  const first = grid.column(point.x - reach);
  const last = grid.column(point.x + reach);
  const top = grid.row(point.y - reach);
  const bottom = grid.row(point.y + reach);

  for (let row = top; row <= bottom; row += 1) {
    for (let column = first; column <= last; column += 1) {
      if (field.water[row * grid.columns + column] !== Water.Lake) continue;
      const dx = grid.x(column) - point.x;
      const dy = grid.y(row) - point.y;
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
  const cell = field.grid.atPoint(point);
  if (field.water[cell] === Water.None && inRiver(field, point)) return Biome.River;
  return field.biome[cell] as Biome;
}

export function groundAt(field: WorldField, point: Vec2): Biome {
  return field.biome[field.grid.atPoint(point)] as Biome;
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
      const bucket = field.reaches.get(keyOf(x, y));
      if (bucket) for (const segment of bucket) found.add(segment);
    }
  }

  return [...found];
}

export interface WaterSheet {
  grid: TileGrid;
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
