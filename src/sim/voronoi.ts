import { boundsCorners, distance, polygonCentroid, vec } from './geometry.ts';
import type { Bounds, Vec2 } from './geometry.ts';
import { hashString, rng } from './rng.ts';
import type { Random } from './rng.ts';

export interface VoronoiRegion {
  index: number;
  site: Vec2;
  vertices: Vec2[];
  neighbors: number[];
}

const EPSILON = 1e-7;

/**
 * Clip `polygon` to the half-plane of points closer to `site` than to `other`: the perpendicular
 * bisector, as a Sutherland-Hodgman cut. Clipping the bounding box by every bisector in turn is
 * O(n²) where a sweepline would be O(n log n), but n here is a few dozen cells and this version
 * has no degenerate-case bookkeeping to get wrong.
 */
function clipByBisector(polygon: readonly Vec2[], site: Vec2, other: Vec2): { polygon: Vec2[]; clipped: boolean } {
  const nx = other.x - site.x;
  const ny = other.y - site.y;
  const offset = (nx * (site.x + other.x) + ny * (site.y + other.y)) / 2;
  const side = (point: Vec2): number => offset - (nx * point.x + ny * point.y);

  const result: Vec2[] = [];
  let clipped = false;

  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i]!;
    const next = polygon[(i + 1) % polygon.length]!;
    const currentSide = side(current);
    const nextSide = side(next);

    if (currentSide >= -EPSILON) result.push(current);
    else clipped = true;

    if ((currentSide > EPSILON && nextSide < -EPSILON) || (currentSide < -EPSILON && nextSide > EPSILON)) {
      const t = currentSide / (currentSide - nextSide);
      result.push(vec(current.x + (next.x - current.x) * t, current.y + (next.y - current.y) * t));
    }
  }

  return { polygon: result, clipped };
}

/** Above this many sites, clipping against every other site stops being affordable. */
const WINDOW_THRESHOLD = 200;
/** Rings of the site grid to clip against. Jittered sites cannot reach beyond two. */
const WINDOW_RINGS = 2;

/**
 * Index of site indices by grid square, so a cell can be clipped against its neighbourhood
 * instead of the whole map. Sites come from a jittered grid and never stray more than one square
 * from their slot, so a cell cannot reach past two rings — clipping against those is the same
 * answer as clipping against all of them, for a fraction of the work.
 */
function windowIndex(sites: readonly Vec2[], bounds: Bounds): {
  columns: number;
  rows: number;
  width: number;
  height: number;
  buckets: number[][];
} {
  // Square-ish buckets, about one site each, derived from the bounds' own aspect — not from
  // sqrt(n), which silently assumes a square map and makes the buckets long and thin on a wide
  // one. Two rings of thin buckets can miss a site that genuinely bounds the cell, and the cell
  // comes out too large: the error is invisible except as a seam where two maps meet.
  const span = Math.max(1e-6, bounds.maxX - bounds.minX);
  const rise = Math.max(1e-6, bounds.maxY - bounds.minY);
  const pitch = Math.sqrt((span * rise) / Math.max(1, sites.length));
  const columns = Math.max(1, Math.round(span / pitch));
  const rows = Math.max(1, Math.round(rise / pitch));
  const width = span / columns;
  const height = rise / rows;
  const buckets: number[][] = Array.from({ length: columns * rows }, () => []);

  sites.forEach((site, index) => {
    const column = Math.min(columns - 1, Math.max(0, Math.floor((site.x - bounds.minX) / width)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor((site.y - bounds.minY) / height)));
    buckets[row * columns + column]!.push(index);
  });

  return { columns, rows, width, height, buckets };
}

export function computeVoronoi(sites: readonly Vec2[], bounds: Bounds): VoronoiRegion[] {
  const frame = boundsCorners(bounds);
  const windowed = sites.length > WINDOW_THRESHOLD ? windowIndex(sites, bounds) : null;

  return sites.map((site, index) => {
    let cell: Vec2[] = frame;
    const neighbors: number[] = [];
    let candidates: readonly number[];

    if (windowed) {
      const column = Math.min(
        windowed.columns - 1,
        Math.max(0, Math.floor((site.x - bounds.minX) / windowed.width)),
      );
      const row = Math.min(
        windowed.rows - 1,
        Math.max(0, Math.floor((site.y - bounds.minY) / windowed.height)),
      );
      const near: number[] = [];
      for (let dy = -WINDOW_RINGS; dy <= WINDOW_RINGS; dy += 1) {
        for (let dx = -WINDOW_RINGS; dx <= WINDOW_RINGS; dx += 1) {
          const cx = column + dx;
          const cy = row + dy;
          if (cx < 0 || cy < 0 || cx >= windowed.columns || cy >= windowed.rows) continue;
          near.push(...windowed.buckets[cy * windowed.columns + cx]!);
        }
      }
      candidates = near;
    } else {
      candidates = sites.map((_, other) => other);
    }

    for (const other of candidates) {
      if (other === index || cell.length === 0) continue;
      const cut = clipByBisector(cell, site, sites[other]!);
      cell = cut.polygon;
      if (cut.clipped) neighbors.push(other);
    }

    // A site whose bisector only shaved a corner off early can end up sharing no final edge.
    const touching = neighbors.filter((other) =>
      cell.some((vertex) => Math.abs(distance(vertex, site) - distance(vertex, sites[other]!)) < 1e-3),
    );

    return { index, site, vertices: cell, neighbors: touching };
  });
}

/** Lloyd relaxation: move each site to its cell's centroid so the diagram stops looking spiky. */
export function relax(sites: readonly Vec2[], bounds: Bounds, passes: number): Vec2[] {
  let current = [...sites];
  for (let pass = 0; pass < passes; pass += 1) {
    current = computeVoronoi(current, bounds).map((region) =>
      region.vertices.length >= 3 ? polygonCentroid(region.vertices) : region.site,
    );
  }
  return current;
}

/** Jittered-grid sites: even coverage without the clumping of pure random scatter. */
export function scatterSites(random: Random, bounds: Bounds, count: number): Vec2[] {
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const cellWidth = (bounds.maxX - bounds.minX) / columns;
  const cellHeight = (bounds.maxY - bounds.minY) / rows;
  const sites: Vec2[] = [];

  for (let row = 0; row < rows && sites.length < count; row += 1) {
    for (let column = 0; column < columns && sites.length < count; column += 1) {
      sites.push(
        vec(
          bounds.minX + (column + 0.15 + random() * 0.7) * cellWidth,
          bounds.minY + (row + 0.15 + random() * 0.7) * cellHeight,
        ),
      );
    }
  }

  return sites;
}

export function voronoiFromSeed(seed: number, bounds: Bounds, count: number, passes = 2): VoronoiRegion[] {
  const random = rng(seed);
  return computeVoronoi(relax(scatterSites(random, bounds, count), bounds, passes), bounds);
}

/**
 * Sites of the world's own jittered lattice covering a rectangle, in world coordinates.
 *
 * Every site is a pure function of its lattice index, so *any* map that needs cells over a patch
 * of world computes the identical sites for it. That is what makes neighbouring maps tile: they
 * are not two meshes that happen to meet, they are two windows onto one mesh that was never
 * built in full. Scattering per map — in the map's own local units — can only ever approximate a
 * shared edge, because the two maps have no site in common.
 */
export function latticeSites(seed: number, spacing: number, bounds: Bounds): Vec2[] {
  const firstColumn = Math.floor(bounds.minX / spacing);
  const lastColumn = Math.ceil(bounds.maxX / spacing);
  const firstRow = Math.floor(bounds.minY / spacing);
  const lastRow = Math.ceil(bounds.maxY / spacing);

  const sites: Vec2[] = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const random = rng(hashString(`${column}:${row}:${seed}`));
      sites.push(
        vec((column + 0.15 + random() * 0.7) * spacing, (row + 0.15 + random() * 0.7) * spacing),
      );
    }
  }

  return sites;
}
