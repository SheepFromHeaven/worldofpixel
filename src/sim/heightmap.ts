import type { Vec2 } from './geometry.ts';
import { noise2 } from './rng.ts';

/**
 * The world's own extent. Ground past its edge falls away into open sea.
 *
 * The field is worked out at a fixed half-parcel cell, so this is not a coastline scaled up — it
 * is more coastline, more islands, more river at the size they already were. Which is the only
 * way a world gets to feel large: a parcel stays the size it is while there is more of
 * everything else. It is also the only thing that sets how far the camera can pull back, since
 * the zoom floor is whatever fits the world in the window.
 *
 * It costs cells quadratically — see the notes in `README.md` on what a bigger world buys and
 * what it charges for.
 */
export const WORLD_EXTENT = { width: 8000, height: 5600 };

/** Sea drawn around the world, so its coast is never the edge of the paper. */
export const WORLD_MARGIN = 1760;

/** Where the land stops. Shared so a height view breaks its ramp on the coast the biomes drew. */
export const SEA_LEVEL = 0.42;

/**
 * The grid the world is worked out on: half a parcel, so a river can be narrower than the ground
 * it crosses and a lake can have a shore inside one.
 *
 * Half of `PARCEL`, written as a number rather than imported from `parcels.ts` — the lattice
 * reads the field, so taking the constant the other way round would close a cycle. Level 7
 * asserts the two agree.
 */
export const FIELD = 1.9;

/**
 * How far past the world's extent the field is computed.
 *
 * The skirt exists so the coast of the world has sea *in the field* beside it, and so the flood
 * that names the ocean starts somewhere that is certainly ocean. Wide enough that the falloff
 * below has somewhere to drown the land gradually rather than cutting it off at a line.
 */
const SKIRT = 200;

/**
 * How steeply the falloff climbs past the world's own edge.
 *
 * Derived from the skirt, never picked, because the two are the same rule seen twice: nothing
 * may clear sea level beyond the extent, and the skirt is where the field stops being computed
 * at all. Left as a constant they drifted apart the moment the world was made bigger — the
 * skirt stayed where it was while the distance the falloff needed grew with the extent, and a
 * strip of land survived all the way to the edge of the array. Ground cut off by the end of an
 * array rather than by a coast is *exactly* level, so the rivers crossing it ran arrow-straight
 * for a hundred units at a time.
 */
const BEYOND = (0.35 * Math.max(WORLD_EXTENT.width, WORLD_EXTENT.height)) / SKIRT;

export interface FieldGrid {
  columns: number;
  rows: number;
  minX: number;
  minY: number;
  spacing: number;
}

export function worldGrid(spacing = FIELD): FieldGrid {
  return {
    minX: -SKIRT,
    minY: -SKIRT,
    spacing,
    columns: Math.ceil((WORLD_EXTENT.width + SKIRT * 2) / spacing),
    rows: Math.ceil((WORLD_EXTENT.height + SKIRT * 2) / spacing),
  };
}

export const cellX = (grid: FieldGrid, column: number): number =>
  grid.minX + (column + 0.5) * grid.spacing;

export const cellY = (grid: FieldGrid, row: number): number =>
  grid.minY + (row + 0.5) * grid.spacing;

/** The cell a world point falls in, clamped to the grid: outside it, the nearest edge cell. */
export function cellColumn(grid: FieldGrid, x: number): number {
  const column = Math.floor((x - grid.minX) / grid.spacing);
  return column < 0 ? 0 : column >= grid.columns ? grid.columns - 1 : column;
}

export function cellRow(grid: FieldGrid, y: number): number {
  const row = Math.floor((y - grid.minY) / grid.spacing);
  return row < 0 ? 0 : row >= grid.rows ? grid.rows - 1 : row;
}

export const cellAtPoint = (grid: FieldGrid, point: Vec2): number =>
  cellRow(grid, point.y) * grid.columns + cellColumn(grid, point.x);

/**
 * Nine octaves, from 420 world units down to about one and a half.
 *
 * Six was enough while the ground was only ever looked at: the finest octave was thirteen units,
 * a third of a parcel, and nothing below that was missed. Water made the last three necessary.
 * Run downhill over a field that is smooth at the scale of a cell and the water has no small
 * valley to find, so every river runs dead straight down the one slope there is, and the whole
 * map drains in parallel lines. Roughness at the size of a cell is what makes a drainage basin
 * branch — the detail is barely visible in the ground and is most of what the rivers are.
 */
const OCTAVES = 9;
const BASE_WAVELENGTH = 420;

/** Pull a 0..1 sample away from its mean; raw value noise clusters too tightly to make biomes. */
const contrast = (value: number, amount = 1.9): number =>
  Math.min(1, Math.max(0, 0.5 + (value - 0.5) * amount));

/**
 * Fractal noise over world coordinates. Six octaves from 420 units down to about 13, so the same
 * field carries both the shape of a continent and the lake you only notice once you walk in.
 */
export function fbm(x: number, y: number, seed: number): number {
  let amplitude = 1;
  let wavelength = BASE_WAVELENGTH;
  let sum = 0;
  let total = 0;

  for (let octave = 0; octave < OCTAVES; octave += 1) {
    sum += amplitude * noise2(x / wavelength, y / wavelength, seed + octave * 7919);
    total += amplitude;
    amplitude *= 0.5;
    wavelength *= 0.5;
  }

  return sum / total;
}

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Fractal noise alone averages out to mid-elevation everywhere, so a map made from it is all
 * land and no coast. Pulling the elevation down toward the edges of the world gives the atlas
 * continents with a sea around them — and because the falloff is a function of world position
 * like everything else here, a region sees the same coast the atlas does.
 */
/**
 * How far out the coastal ramp wanders, and over what distance.
 *
 * Only the ramp — never the bound past it, which is what guarantees no land survives to the
 * edge of the field. A warped ramp is what stops the world being a rectangle with rounded
 * corners: it moves the whole coastal gradient about, so the continents end where the noise and
 * the warp agree rather than where the arithmetic does.
 */
const COAST_WARP = 0.07;
const COAST_WAVE = 2600;

/**
 * Six, not infinity.
 *
 * `max(dx, dy)` is the infinity-norm, and its gradient over the left and right thirds of the
 * world points *exactly* along x — the same direction at every point of a third of the map. On
 * flat ground that is a bigger slope than the terrain's own, so every river in a plain runs due
 * east in parallel, and the map reads as a circuit board. A smooth norm has a gradient that
 * turns with position, so it steers rivers apart instead of combing them.
 */
const NORM = 6;

function shoreFalloff(x: number, y: number): number {
  const dx = Math.abs(x - WORLD_EXTENT.width / 2) / (WORLD_EXTENT.width / 2);
  const dy = Math.abs(y - WORLD_EXTENT.height / 2) / (WORLD_EXTENT.height / 2);
  const reach = (dx ** NORM + dy ** NORM) ** (1 / NORM);
  const warp = (noise2(x / COAST_WAVE, y / COAST_WAVE, 4441) - 0.5) * 2 * COAST_WARP;

  // Past the world's own edge the falloff keeps growing until nothing can clear sea level. A
  // falloff that merely saturates leaves the noise free to throw up land for ever, and with it
  // the rivers and seams that land carries — miles beyond anything the map draws. The warp is
  // kept out of that term on purpose: the bound has to be arithmetic, or the skirt stops being
  // wide enough to hold the coast.
  return smoothstep(0.55, 1.05, reach + warp) * 0.5 + Math.max(0, reach - 1) * BEYOND;
}

/** The land before any water has run over it: the raw continent, 0 at the bottom of the sea. */
export function baseHeight(x: number, y: number, seed: number): number {
  return Math.max(0, contrast(fbm(x, y, seed + 11)) - shoreFalloff(x, y));
}

export function baseHeights(grid: FieldGrid, seed: number): Float32Array {
  const heights = new Float32Array(grid.columns * grid.rows);

  for (let row = 0; row < grid.rows; row += 1) {
    const y = cellY(grid, row);
    const at = row * grid.columns;
    for (let column = 0; column < grid.columns; column += 1) {
      heights[at + column] = baseHeight(cellX(grid, column), y, seed);
    }
  }

  return heights;
}

/**
 * Roughly how much of the world is land, on a strided grid — a few milliseconds, which is what
 * lets a seed be rolled until the map has somewhere to live. The noise is free to come up almost
 * all sea, and a world you have to hunt across for a parcel of dirt is not a world to open on.
 *
 * The raw heightmap, not the finished field: this is asked before a seed is committed to, and
 * building the hydrology of a map nobody will play is the whole cost of the roll.
 */
export function landFraction(seed: number): number {
  const grid = worldGrid();
  const stride = 6;
  let land = 0;
  let total = 0;

  for (let row = 0; row < grid.rows; row += stride) {
    const y = cellY(grid, row);
    for (let column = 0; column < grid.columns; column += stride) {
      total += 1;
      if (baseHeight(cellX(grid, column), y, seed) >= SEA_LEVEL) land += 1;
    }
  }

  return land / total;
}
