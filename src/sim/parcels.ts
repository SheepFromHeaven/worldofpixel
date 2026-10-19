import { distance } from './geometry.ts';
import type { Bounds, Vec2 } from './geometry.ts';
import { hashString, rng } from './rng.ts';
import { biomeAt, terrainAt } from './terrain.ts';
import type { Biome, CellId, Environment } from './types.ts';
import { computeVoronoi } from './voronoi.ts';

/**
 * Three spacings of one lattice, in world units. They are levels of *detail*, not places: the
 * world is continuous and unbounded by anything but its own coastline, and zooming in simply
 * resolves a finer grid. Nothing is divided into territories, because nobody has been there to
 * divide it — only a settlement gives a patch of ground a name.
 */
export const DETAIL = {
  vast: 126.4,
  coarse: 31.6,
  medium: 7.8,
  fine: 3.8,
} as const;

export type Detail = keyof typeof DETAIL;

/** The grid the simulation builds on: a parcel is one cell of the finest lattice. */
export const PARCEL = DETAIL.fine;

export interface Parcel {
  id: CellId;
  site: Vec2;
  vertices: Vec2[];
  neighbors: CellId[];
  environment: Environment;
  biome: Biome;
}

export const parcelId = (column: number, row: number): CellId => `${column}:${row}`;

export function parcelIndex(id: CellId): { column: number; row: number } {
  const [column, row] = id.split(':').map(Number) as [number, number];
  return { column, row };
}

/**
 * Where the lattice puts the site of one cell. A pure function of the index, so any part of the
 * program — the simulation, the renderer, a map drawn at a different zoom — agrees about it
 * without anything being stored.
 */
export function siteOf(seed: number, spacing: number, column: number, row: number): Vec2 {
  const random = rng(hashString(`${column}:${row}:${seed}`));
  return {
    x: (column + 0.15 + random() * 0.7) * spacing,
    y: (row + 0.15 + random() * 0.7) * spacing,
  };
}

/** The cell a point falls in: the nearest site, which is what a Voronoi cell means. */
export function cellAt(seed: number, spacing: number, point: Vec2): CellId {
  const column = Math.floor(point.x / spacing);
  const row = Math.floor(point.y / spacing);

  let best = parcelId(column, row);
  let bestGap = Infinity;

  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const gap = distance(point, siteOf(seed, spacing, column + dx, row + dy));
      if (gap < bestGap) {
        bestGap = gap;
        best = parcelId(column + dx, row + dy);
      }
    }
  }

  return best;
}

interface Indexed {
  site: Vec2;
  column: number;
  row: number;
}

function sitesIn(seed: number, spacing: number, bounds: Bounds): Indexed[] {
  const firstColumn = Math.floor(bounds.minX / spacing);
  const lastColumn = Math.ceil(bounds.maxX / spacing);
  const firstRow = Math.floor(bounds.minY / spacing);
  const lastRow = Math.ceil(bounds.maxY / spacing);

  const sites: Indexed[] = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      sites.push({ site: siteOf(seed, spacing, column, row), column, row });
    }
  }
  return sites;
}

/** Rings of lattice computed beyond the area asked for, so every cell returned is complete. */
const MARGIN_RINGS = 3;

/**
 * Every cell overlapping a rectangle, with its polygon and its neighbours. Cells are computed
 * over a wider rectangle than asked for so the ones handed back have their full neighbourhood —
 * a cell clipped by the edge of the request would differ from the same cell computed by a
 * request next door, and the two would not line up.
 */
export function cellsIn(seed: number, spacing: number, bounds: Bounds): Parcel[] {
  const margin = spacing * MARGIN_RINGS;
  const wide: Bounds = {
    minX: bounds.minX - margin,
    minY: bounds.minY - margin,
    maxX: bounds.maxX + margin,
    maxY: bounds.maxY + margin,
  };

  const indexed = sitesIn(seed, spacing, wide);
  const regions = computeVoronoi(
    indexed.map((entry) => entry.site),
    wide,
  );

  const parcels: Parcel[] = [];
  regions.forEach((region, index) => {
    const entry = indexed[index];
    if (!entry) return;
    if (
      entry.site.x < bounds.minX - spacing ||
      entry.site.x > bounds.maxX + spacing ||
      entry.site.y < bounds.minY - spacing ||
      entry.site.y > bounds.maxY + spacing
    ) {
      return;
    }

    const environment = terrainAt(seed, entry.site);
    parcels.push({
      id: parcelId(entry.column, entry.row),
      site: entry.site,
      vertices: region.vertices,
      neighbors: region.neighbors
        .map((other) => indexed[other])
        .filter((other): other is Indexed => other !== undefined)
        .map((other) => parcelId(other.column, other.row)),
      environment,
      biome: biomeAt(seed, entry.site),
    });
  });

  return parcels;
}

const cache = new Map<CellId, Parcel>();

/**
 * Which world the cache holds. A parcel is a function of the seed, so a cache that is not is a
 * cache that hands the new world the old world's ground — and silently, since every id still
 * resolves.
 */
let cachedSeed: number | null = null;

/**
 * One cell on its own, cached. Computed from a block of lattice around it rather than from the
 * whole world: a jittered site never reaches past two rings, so a block of seven is more than
 * the cell can possibly touch, and the answer matches what `cellsIn` would have given.
 */
export function parcelOf(seed: number, id: CellId): Parcel {
  if (cachedSeed !== seed) {
    cache.clear();
    cachedSeed = seed;
  }

  const hit = cache.get(id);
  if (hit) return hit;

  const { column, row } = parcelIndex(id);
  const block: Bounds = {
    minX: (column - 1) * PARCEL,
    minY: (row - 1) * PARCEL,
    maxX: (column + 2) * PARCEL,
    maxY: (row + 2) * PARCEL,
  };

  for (const parcel of cellsIn(seed, PARCEL, block)) {
    if (!cache.has(parcel.id)) cache.set(parcel.id, parcel);
  }

  const parcel = cache.get(id);
  if (parcel) return parcel;

  // A lattice cell always exists; this only guards an impossible numeric edge.
  const site = siteOf(seed, PARCEL, column, row);
  const environment = terrainAt(seed, site);
  const fallback: Parcel = {
    id,
    site,
    vertices: [],
    neighbors: [],
    environment,
    biome: biomeAt(seed, site),
  };
  cache.set(id, fallback);
  return fallback;
}

export const parcelAt = (seed: number, point: Vec2): Parcel =>
  parcelOf(seed, cellAt(seed, PARCEL, point));

/** Forget cached geometry — only used when a world is replaced. */
export function forgetParcels(): void {
  cache.clear();
}
