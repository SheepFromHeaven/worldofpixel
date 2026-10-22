import type { Rgba } from '../pixel/color.ts';
import { PARCEL, parcelIndex, siteOf } from '../sim/parcels.ts';
import type { Detail } from '../sim/parcels.ts';
import { SEA_LEVEL, groundBiomeAt, riverRunsIn, terrainAt, waterSheet } from '../sim/terrain.ts';
import type { WaterSheet } from '../sim/terrain.ts';
import { Water } from '../sim/hydrology.ts';
import { Biome } from '../sim/types.ts';
import type { GameWorld } from '../sim/world.ts';
import { BIOME_RAMPS, PATH_RAMPS } from './palette.ts';
import { neighbours, positionOf, wornness } from '../sim/footpaths.ts';
import { LIVE_MIPS, MIPS, RIDGES, decalCells, dugAt, felledAt, groundSprites, groundVersion, placementsIn, siteTrees } from './groundSprites.ts';
import type { GroundSprites, Material, Placement } from './groundSprites.ts';

export const TEXELS_PER_PARCEL = 32;

export const TEXEL = PARCEL / TEXELS_PER_PARCEL;

export interface GroundLevel {
  detail: Detail;
  spacing: number;
  texels: number;
  texel: number;
  cells: number;
}

const CHUNK_TEXELS = 256;

const MOSAIC_MIN_TEXELS = 3.5;

const mosaic = (texel: number): number => {
  let spacing = PARCEL;
  while (spacing < texel * MOSAIC_MIN_TEXELS) spacing *= 2;
  return spacing;
};

const level = (detail: Detail, texel: number): GroundLevel => {
  const spacing = mosaic(texel);
  return { detail, spacing, texels: spacing / texel, texel, cells: (CHUNK_TEXELS * texel) / spacing };
};

export const LEVELS: readonly GroundLevel[] = Array.from({ length: 9 }, (_, i) =>
  level(
    (['vast', 'vast', 'coarse', 'coarse', 'coarse', 'coarse', 'medium', 'medium', 'fine'] as const)[i]!,
    (PARCEL / TEXELS_PER_PARCEL) * 2 ** (8 - i),
  ),
);

export const MIN_TEXEL_PIXELS = 2;

export function levelFor(zoom: number): GroundLevel {
  for (let i = LEVELS.length - 1; i > 0; i -= 1) {
    if (LEVELS[i]!.texel * zoom >= MIN_TEXEL_PIXELS) return LEVELS[i]!;
  }
  return LEVELS[0]!;
}

const FADE = 0.38;

const SETTLED = 1.15 ** 2;

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const threshold = (ix: number, iy: number): number =>
  ((BAYER[((iy % 4) + 4) % 4]?.[((ix % 4) + 4) % 4] ?? 0) + 0.5) / 16;

function rampStep(ramp: readonly Rgba[], shade: number, ix: number, iy: number): number {
  const t = Math.min(1, Math.max(0, shade)) * (ramp.length - 1);
  const low = Math.floor(t);
  return t - low > threshold(ix + 2, iy + 1) ? Math.min(low + 1, ramp.length - 1) : low;
}

interface Lattice {
  firstColumn: number;
  firstRow: number;
  columns: number;
  rows: number;
  x: Float64Array;
  y: Float64Array;
  elevation: Float64Array;
  biome: Uint8Array;
  wet: Uint8Array;
}

const RAMPS: readonly (readonly Rgba[])[] = [
  BIOME_RAMPS[Biome.Meadow],
  BIOME_RAMPS[Biome.Forest],
  BIOME_RAMPS[Biome.Highland],
  BIOME_RAMPS[Biome.Marsh],
  BIOME_RAMPS[Biome.Tundra],
  BIOME_RAMPS[Biome.Desert],
  BIOME_RAMPS[Biome.Ocean],
  BIOME_RAMPS[Biome.Lake],
  BIOME_RAMPS[Biome.River],
];

const RAMP_INDEX: Record<Biome, number> = {
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

const WET: readonly boolean[] = RAMPS.map((_, index) =>
  index === RAMP_INDEX[Biome.Ocean] || index === RAMP_INDEX[Biome.Lake],
);

interface Site {
  x: number;
  y: number;
  elevation: number;
  biome: number;
}

const sites = new Map<number, Map<number, Site>>();

let cachedSeed: number | null = null;

const SITE_BUDGET = 120_000;

function siteAt(world: GameWorld, spacing: number, column: number, row: number): Site {
  if (cachedSeed !== world.seed) {
    sites.clear();
    cachedSeed = world.seed;
  }

  let cache = sites.get(spacing);
  if (!cache) {
    cache = new Map();
    sites.set(spacing, cache);
  }

  const key = (column + 0x8000) * 0x10000 + (row + 0x8000);
  const known = cache.get(key);
  if (known) return known;

  const where = siteOf(world.seed, spacing, column, row);
  const environment = terrainAt(world.seed, where);
  const site: Site = {
    x: where.x,
    y: where.y,
    elevation: environment.elevation,
    biome: RAMP_INDEX[groundBiomeAt(world.seed, where)],
  };

  if (cache.size >= SITE_BUDGET) cache.clear();
  cache.set(key, site);
  return site;
}

function latticeOver(
  world: GameWorld,
  spacing: number,
  firstColumn: number,
  firstRow: number,
  columns: number,
  rows: number,
): Lattice {
  const count = columns * rows;
  const lattice: Lattice = {
    firstColumn,
    firstRow,
    columns,
    rows,
    x: new Float64Array(count),
    y: new Float64Array(count),
    elevation: new Float64Array(count),
    biome: new Uint8Array(count),
    wet: new Uint8Array(count),
  };

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const site = siteAt(world, spacing, firstColumn + column, firstRow + row);
      const at = row * columns + column;
      lattice.x[at] = site.x;
      lattice.y[at] = site.y;
      lattice.elevation[at] = site.elevation;
      lattice.biome[at] = site.biome;
      lattice.wet[at] = WET[site.biome]! ? 1 : 0;
    }
  }

  return lattice;
}

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x85ebca6b) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function mottle(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);

  const top = a + (b - a) * u;
  return top + (c + (d - c) * u - top) * v;
}

const RELIEF = 0.45;
const RELIEF_SLOPE = 0.0035;

const BROAD = 7;

function slopeToward(level: FieldLevel, x: number, y: number, span: number): number {
  const toward = level.height[waterCell(level, x - span, y - span)]!;
  const away = level.height[waterCell(level, x + span, y + span)]!;

  return (away - toward) / (span * 2 * Math.SQRT2);
}

function relief(level: FieldLevel, x: number, y: number, span: number): number {
  const local = slopeToward(level, x, y, span);
  const broad = slopeToward(level, x, y, span * BROAD);
  return Math.max(-1, Math.min(1, (local - broad) / RELIEF_SLOPE)) * RELIEF;
}

const BLOTCH = PARCEL * 1.7;
const GRAIN_TEXELS = 13.4;

const BLOTCH_MIN_TEXELS = 6;

function step(elevation: number, x: number, y: number, texel: number, seed: number): number {
  const blotch = Math.max(BLOTCH, texel * BLOTCH_MIN_TEXELS);
  const paper = texel * GRAIN_TEXELS;
  const coarse = mottle(x / blotch, y / blotch, seed + 101);
  const fine = mottle(x / paper, y / paper, seed + 211);
  const grain = coarse * 0.3 + fine * 0.7;
  const height = (elevation - 0.5) * 0.55;

  return grain * 0.42 + height + 0.32;
}

interface CellFrame {
  columns: number;
  rows: number;
  minX: number;
  minY: number;
  spacing: number;
}

interface FieldLevel extends CellFrame {
  water: Uint8Array;
  height: Float32Array;
}

const mips: FieldLevel[] = [];
let mipSeed: number | null = null;

const MAX_MIP = 8;

function fieldLevel(sheet: WaterSheet, seed: number, texel: number): FieldLevel {
  if (mipSeed !== seed) {
    mips.length = 0;
    mipSeed = seed;
  }

  if (mips.length === 0) {
    const { grid } = sheet;
    mips.push({
      columns: grid.columns,
      rows: grid.rows,
      minX: grid.minX,
      minY: grid.minY,
      spacing: grid.spacing,
      water: sheet.water,
      height: sheet.height,
    });
  }

  const want = Math.min(
    MAX_MIP,
    Math.max(0, Math.round(Math.log2(texel / sheet.grid.spacing))),
  );

  while (mips.length <= want) {
    const under = mips[mips.length - 1]!;
    const columns = Math.max(1, under.columns >> 1);
    const rows = Math.max(1, under.rows >> 1);
    const water = new Uint8Array(columns * rows);
    const height = new Float32Array(columns * rows);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        let ocean = 0;
        let lake = 0;
        let bed = 0;
        let taken = 0;
        for (let dy = 0; dy < 2; dy += 1) {
          const r = row * 2 + dy;
          if (r >= under.rows) continue;
          for (let dx = 0; dx < 2; dx += 1) {
            const c = column * 2 + dx;
            if (c >= under.columns) continue;
            const at = r * under.columns + c;
            const kind = under.water[at]!;
            if (kind === Water.Ocean) ocean += 1;
            else if (kind === Water.Lake) lake += 1;
            bed += under.height[at]!;
            taken += 1;
          }
        }

        water[row * columns + column] =
          ocean + lake < 2 ? Water.None : ocean >= lake ? Water.Ocean : Water.Lake;

        height[row * columns + column] = taken === 0 ? 0 : bed / taken;
      }
    }

    mips.push({
      columns,
      rows,
      minX: under.minX,
      minY: under.minY,
      spacing: under.spacing * 2,
      water,
      height,
    });
  }

  return mips[want]!;
}

function waterCell(frame: CellFrame, x: number, y: number): number {
  let column = Math.floor((x - frame.minX) / frame.spacing);
  let row = Math.floor((y - frame.minY) / frame.spacing);
  column = column < 0 ? 0 : column >= frame.columns ? frame.columns - 1 : column;
  row = row < 0 ? 0 : row >= frame.rows ? frame.rows - 1 : row;
  return row * frame.columns + column;
}

const SHORE_WANDER = 0.8;

const wetSign = (level: FieldLevel, column: number, row: number): number => {
  const c = column < 0 ? 0 : column >= level.columns ? level.columns - 1 : column;
  const r = row < 0 ? 0 : row >= level.rows ? level.rows - 1 : row;
  return level.water[r * level.columns + c]! === Water.None ? -1 : 1;
};

function floodedAt(level: FieldLevel, x: number, y: number, smooth: boolean, seed: number): number {
  const at = waterCell(level, x, y);
  const here = level.water[at]!;
  if (!smooth) return here;

  const column = at % level.columns;
  const row = (at - column) / level.columns;
  let shore = false;
  for (let r = row - 1; r <= row + 1 && !shore; r += 1) {
    if (r < 0 || r >= level.rows) continue;
    for (let c = column - 1; c <= column + 1; c += 1) {
      if (c < 0 || c >= level.columns) continue;
      if (level.water[r * level.columns + c]! !== here) {
        shore = true;
        break;
      }
    }
  }
  if (!shore) return here;

  const fx = (x - level.minX) / level.spacing - 0.5;
  const fy = (y - level.minY) / level.spacing - 0.5;
  const left = Math.floor(fx);
  const top = Math.floor(fy);
  const u = fx - left;
  const v = fy - top;

  const above =
    wetSign(level, left, top) + (wetSign(level, left + 1, top) - wetSign(level, left, top)) * u;
  const below =
    wetSign(level, left, top + 1) +
    (wetSign(level, left + 1, top + 1) - wetSign(level, left, top + 1)) * u;
  const surface = above + (below - above) * v;

  const wave = level.spacing * 2.4;
  const fine = level.spacing * 0.8;
  const wobble =
    (mottle(x / wave, y / wave, seed + 911) * 0.55 +
      mottle(x / fine, y / fine, seed + 947) * 0.45 -
      0.5) *
    2 *
    SHORE_WANDER;

  if (surface <= wobble) return Water.None;
  if (here !== Water.None) return here;

  let kind: number = Water.Ocean;
  let best = -1;
  for (let dy = 0; dy <= 1; dy += 1) {
    for (let dx = 0; dx <= 1; dx += 1) {
      const c = Math.min(Math.max(left + dx, 0), level.columns - 1);
      const r = Math.min(Math.max(top + dy, 0), level.rows - 1);
      const found = level.water[r * level.columns + c]!;
      if (found === Water.None) continue;
      const weight = (dx === 0 ? 1 - u : u) * (dy === 0 ? 1 - v : v);
      if (weight > best) {
        best = weight;
        kind = found;
      }
    }
  }
  return kind;
}

interface Run {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  half: number;
  minY: number;
  maxY: number;
}

interface Junction {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
  minY: number;
  maxY: number;
}

const PATH_HALF = 0.15;
const PATH_FADE = 0.075;

const LOT_HALF = 0.5;

const PATH_MIN_TEXELS = 2;

function pavedCells(world: GameWorld): { column: number; row: number }[] {
  const cells: { column: number; row: number }[] = [];
  for (const settlement of world.settlements.values()) {
    for (const building of settlement.buildings.values()) if (dugAt(building) > 0) cells.push(parcelIndex(building.cellId));
  }
  return cells;
}

const PATH_SHOWS = 0.1;

function footpathRuns(world: GameWorld): Run[] {
  const runs: Run[] = [];
  const reach = PARCEL * (PATH_HALF + PATH_FADE);
  for (const id of world.wear.keys()) {
    const here = wornness(world, id);
    if (here < PATH_SHOWS) continue;
    const a = positionOf(world, id);
    for (const next of neighbours(world, id)) {
      if (next <= id) continue;
      const there = wornness(world, next);
      if (there < PATH_SHOWS) continue;
      const b = positionOf(world, next);
      runs.push({
        ax: a.x, ay: a.y, bx: b.x, by: b.y,
        half: PARCEL * PATH_HALF * (0.3 + 0.7 * Math.min(here, there)),
        minY: Math.min(a.y, b.y) - reach,
        maxY: Math.max(a.y, b.y) + reach,
      });
    }
  }
  return runs;
}

function runsIn(
  world: GameWorld,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): { runs: Run[]; junctions: Junction[] } {
  const reach = PARCEL * (PATH_HALF + PATH_FADE);
  const lot = PARCEL * (LOT_HALF + PATH_FADE);
  const runs: Run[] = [];

  for (const settlement of world.settlements.values()) {
    for (const building of settlement.buildings.values()) {
      const dug = dugAt(building);
      if (dug <= 0) continue;
      const { column, row } = parcelIndex(building.cellId);
      const at = siteOf(world.seed, PARCEL, column, row);
      runs.push({ ax: at.x, ay: at.y, bx: at.x, by: at.y, half: PARCEL * LOT_HALF * dug, minY: at.y - lot, maxY: at.y + lot });
    }
  }
  runs.push(...footpathRuns(world));

  return {
    runs: runs.filter(
      (run) =>
        Math.min(run.ax, run.bx) - Math.max(lot, reach) <= maxX &&
        Math.max(run.ax, run.bx) + Math.max(lot, reach) >= minX &&
        run.minY <= maxY &&
        run.maxY >= minY,
    ),
    junctions: [],
  };
}

function inside(j: Junction, x: number, y: number): boolean {
  const d1 = (x - j.bx) * (j.ay - j.by) - (j.ax - j.bx) * (y - j.by);
  const d2 = (x - j.cx) * (j.by - j.cy) - (j.bx - j.cx) * (y - j.cy);
  const d3 = (x - j.ax) * (j.cy - j.ay) - (j.cx - j.ax) * (y - j.ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function gapTo(run: Run, x: number, y: number): number {
  const dx = run.bx - run.ax;
  const dy = run.by - run.ay;
  const along = dx * dx + dy * dy;
  const t = along === 0 ? 0 : Math.max(0, Math.min(1, ((x - run.ax) * dx + (y - run.ay) * dy) / along));
  const px = run.ax + dx * t - x;
  const py = run.ay + dy * t - y;
  return px * px + py * py;
}

export function pavingIn(world: GameWorld, minX: number, minY: number, maxX: number, maxY: number): number {
  let hash = 0;
  for (const index of pavedCells(world)) {
    const x = index.column * PARCEL;
    const y = index.row * PARCEL;
    const spill = PARCEL;
    if (x - spill > maxX || x + PARCEL + spill < minX || y - spill > maxY || y + PARCEL + spill < minY) continue;

    let cell = Math.imul(index.column + 0x9e37, 0x85ebca6b) ^ Math.imul(index.row + 0x7f4a, 0xc2b2ae35);
    cell = Math.imul(cell ^ (cell >>> 15), 0x2c1b3c6d);
    hash = (hash ^ (cell ^ (cell >>> 13))) >>> 0;
  }

  for (const [id] of world.wear) {
    const tier = Math.floor(wornness(world, id) * 6);
    if (tier === 0) continue;
    const at = positionOf(world, id);
    const spill = PARCEL;
    if (at.x - spill > maxX || at.x + spill < minX || at.y - spill > maxY || at.y + spill < minY) continue;
    let node = Math.imul(Math.round(at.x * 64) + 0x3c6e, 0x9e3779b1) ^ Math.imul(Math.round(at.y * 64) + tier * 0x10000, 0x85ebca6b);
    node = Math.imul(node ^ (node >>> 15), 0x2c1b3c6d);
    hash = (hash ^ (node ^ (node >>> 13))) >>> 0;
  }

  const sprites = groundSprites();
  if (sprites) {
    const lot = PARCEL * (LOT_HALF + PATH_FADE);
    for (const settlement of world.settlements.values()) {
      for (const building of settlement.buildings.values()) {
        const { column, row } = parcelIndex(building.cellId);
        const at = siteOf(world.seed, PARCEL, column, row);

        const dug = Math.floor(dugAt(building) * 8);
        if (dug > 0 && at.x - lot <= maxX && at.x + lot >= minX && at.y - lot <= maxY && at.y + lot >= minY) {
          let plot = Math.imul(column + 0x51ed, 0x9e3779b1) ^ Math.imul(row + dug * 0x1000, 0x85ebca77);
          plot = Math.imul(plot ^ (plot >>> 15), 0x2c1b3c6d);
          hash = (hash ^ (plot ^ (plot >>> 13))) >>> 0;
        }

        const site = PARCEL * 3;
        if (at.x - site > maxX || at.x + site < minX || at.y - site > maxY || at.y + site < minY) continue;

        const trees = siteTrees(world, sprites, building);
        const down = felledAt(world, sprites, building);
        for (let i = 0; i < down; i += 1) {
          const tree = trees[i]!;
          const cells = decalCells(tree.decal, 0);
          const left = tree.x - cells.foot.x * TEXEL;
          const top = tree.y - cells.foot.y * TEXEL;
          if (left > maxX || left + cells.width * TEXEL < minX) continue;
          if (top > maxY || top + cells.height * TEXEL < minY) continue;
          let felled = Math.imul(Math.round(tree.x * 64) + 0x51ed, 0x9e3779b1) ^ Math.imul(Math.round(tree.y * 64) + 0x2f1b, 0x85ebca77);
          felled = Math.imul(felled ^ (felled >>> 15), 0x2c1b3c6d);
          hash = (hash ^ (felled ^ (felled >>> 13))) >>> 0;
        }
      }
    }
  }
  return hash >>> 0;
}

interface Reach {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  half: number;
  minY: number;
  maxY: number;
}

const REACH_MIN_TEXELS = 0.9;

const DELTA_STEPS = 3;
const DELTA_STEP = 1.1;
const DELTA_SPREAD = 1.5;

function reachesOver(
  world: GameWorld,
  sheet: WaterSheet,
  texel: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Reach[] {
  const reaches: Reach[] = [];

  for (const run of riverRunsIn(world.seed, { minX, minY, maxX, maxY })) {
    if (run.half * 2 < texel * REACH_MIN_TEXELS) continue;

    reaches.push({
      ax: run.ax,
      ay: run.ay,
      bx: run.bx,
      by: run.by,
      half: run.half,
      minY: Math.min(run.ay, run.by) - run.half,
      maxY: Math.max(run.ay, run.by) + run.half,
    });

    if (sheet.water[waterCell(sheet.grid, run.bx, run.by)] !== Water.Ocean) continue;

    const dx = run.bx - run.ax;
    const dy = run.by - run.ay;
    const along = Math.hypot(dx, dy);
    if (along === 0) continue;

    let fromX = run.bx;
    let fromY = run.by;
    let half = run.half;
    for (let step = 0; step < DELTA_STEPS; step += 1) {
      const reach = half * DELTA_STEP;
      const toX = fromX + (dx / along) * reach;
      const toY = fromY + (dy / along) * reach;
      half *= DELTA_SPREAD;
      reaches.push({
        ax: fromX,
        ay: fromY,
        bx: toX,
        by: toY,
        half,
        minY: Math.min(fromY, toY) - half,
        maxY: Math.max(fromY, toY) + half,
      });
      fromX = toX;
      fromY = toY;
    }
  }

  return reaches;
}

const BANK_WANDER = 0.3;

function bankOffset(x: number, y: number, bank: number, seed: number): number {
  const coarse = mottle(x / (bank * 2.4), y / (bank * 2.4), seed + 821);
  const fine = mottle(x / (bank * 0.8), y / (bank * 0.8), seed + 919);
  return (coarse * 0.62 + fine * 0.38 - 0.5) * 2 * bank * BANK_WANDER;
}

const PLUME = 0.022;

const plume = (bed: number): number =>
  Math.max(0, Math.min(1, (bed - (SEA_LEVEL - PLUME)) / PLUME));

function riverDepthAt(reaches: readonly Reach[], x: number, y: number, seed: number): number {
  let closest = Infinity;
  let bank = 1;

  for (const reach of reaches) {
    const gap = gapToReach(reach, x, y);
    if (gap >= closest) continue;
    closest = gap;
    bank = reach.half;
  }
  if (closest === Infinity) return -1;

  const gap = Math.sqrt(closest) - bank;
  return gap < bankOffset(x, y, bank, seed) ? Math.min(1, -gap / bank) : -1;
}

function gapToReach(reach: Reach, x: number, y: number): number {
  const dx = reach.bx - reach.ax;
  const dy = reach.by - reach.ay;
  const along = dx * dx + dy * dy;
  const t = along === 0 ? 0 : Math.max(0, Math.min(1, ((x - reach.ax) * dx + (y - reach.ay) * dy) / along));
  const px = reach.ax + dx * t - x;
  const py = reach.ay + dy * t - y;
  return px * px + py * py;
}

function pathShade(x: number, y: number, seed: number): number {
  const coarse = mottle(x / (PARCEL * 0.9), y / (PARCEL * 0.9), seed + 401);
  const fine = mottle(x / (PARCEL * 0.3), y / (PARCEL * 0.3), seed + 509);
  return coarse * 0.55 + fine * 0.45;
}

export function chunkKey(
  world: GameWorld,
  rung: number,
  column: number,
  row: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): string {
  const paving = pavingIn(world, bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  return `${world.seed}:${rung}:${column}:${row}:${paving}:${groundVersion()}`;
}

const GROUND_RAMPS: readonly (readonly Rgba[])[] = [
  ...RAMPS,
  PATH_RAMPS.Meadow,
  PATH_RAMPS.Forest,
  PATH_RAMPS.Highland,
  PATH_RAMPS.Marsh,
  PATH_RAMPS.Tundra,
  PATH_RAMPS.Desert,
];

const pathRampOf = (biome: number): number => RAMPS.length + (biome <= RAMP_INDEX[Biome.Desert] ? biome : 0);
const isPathRamp = (ramp: number): boolean => ramp >= RAMPS.length;
const WATER_RAMPS = new Set([RAMP_INDEX[Biome.Ocean], RAMP_INDEX[Biome.Lake], RAMP_INDEX[Biome.River]]);

const MATERIAL_BY_RAMP: readonly (Material | null)[] = [
  'meadow', 'forest', 'highland', 'marsh', 'tundra', 'desert', null, null, null,
];

const VARIANT_SPAN = PARCEL * 3;
const RIDGE_SPAN = PARCEL * 14;

function maskAt(sprites: GroundSprites, material: Material, mip: number, ix: number, iy: number): number {
  const cells = sprites.masks.get(material)?.[mip];
  if (!cells) return 128;
  const size = sprites.size >> mip;
  return cells[(((iy % size) + size) % size) * size + (((ix % size) + size) % size)]!;
}

function textureStep(
  sprites: GroundSprites,
  material: Material,
  mip: number,
  ix: number,
  iy: number,
  x: number,
  y: number,
  seed: number,
): number {
  const ridge = RIDGES[Math.min(RIDGES.length - 1, Math.floor(mottle(x / RIDGE_SPAN, y / RIDGE_SPAN, seed + 811) * RIDGES.length))];
  const list = sprites.variants.get(material === 'desert' ? `desert:${ridge}` : material);
  if (!list || list.length === 0) return 2;
  const v = mottle(x / VARIANT_SPAN, y / VARIANT_SPAN, seed + 701) * list.length;
  let pick = Math.min(list.length - 1, Math.floor(v));
  const t = v - Math.floor(v);
  if (t > 0.8 && pick + 1 < list.length && maskAt(sprites, material, mip, ix, iy) < ((t - 0.8) / 0.2) * 255) pick += 1;
  const cells = list[pick]!.mips[mip]!;
  const size = sprites.size >> mip;
  return cells[(((iy % size) + size) % size) * size + (((ix % size) + size) % size)]!;
}

function seam(sprites: GroundSprites, near: number, next: number, blend: number, mip: number, ix: number, iy: number): boolean {
  const a = MATERIAL_BY_RAMP[near];
  const b = MATERIAL_BY_RAMP[next];
  if (!a || !b) return threshold(ix, iy) < blend;
  if (a === b) return maskAt(sprites, a, mip, ix, iy) < blend * 255;
  const nextHigh = sprites.priority.indexOf(b) < sprites.priority.indexOf(a);
  const reach = nextHigh ? blend : 1 - blend;
  const takeHigh = maskAt(sprites, nextHigh ? b : a, mip, ix, iy) < reach * 255;
  return takeHigh === nextHigh;
}

export function texelsIn(
  world: GameWorld,
  spacing: number,
  texel: number,
  fromX: number,
  fromY: number,
  width: number,
  height: number,
): Uint32Array {
  const out = new Uint32Array(width * height);
  const grounds = new Uint8Array(width * height);
  const steps = new Uint8Array(width * height);
  const paint = (at: number, ramp: number, shade: number, ix: number, iy: number): void => {
    const colors = GROUND_RAMPS[ramp]!;
    const step = rampStep(colors, shade, ix, iy);
    out[at] = colors[step] ?? 0;
    grounds[at] = ramp;
    steps[at] = step;
  };

  const fade = spacing * FADE;
  const settled = spacing * spacing * SETTLED;

  const mip = Math.round(Math.log2(texel / TEXEL));
  const loaded = groundSprites();
  const sprites = loaded && spacing === PARCEL && mip >= 0 && mip < MIPS ? loaded : null;

  const sheet = waterSheet(world.seed);
  const level = fieldLevel(sheet, world.seed, texel);

  const lit = Math.max(level.spacing, PARCEL * 0.5);
  const smooth = level.spacing > texel;

  const firstColumn = Math.floor((fromX * texel) / spacing) - 2;
  const firstRow = Math.floor((fromY * texel) / spacing) - 2;
  const columns = Math.ceil((width * texel) / spacing) + 5;
  const rows = Math.ceil((height * texel) / spacing) + 5;
  const lattice = latticeOver(world, spacing, firstColumn, firstRow, columns, rows);

  const half = PARCEL * PATH_HALF;
  const band = PARCEL * PATH_FADE;
  const paved =
    half * 2 >= texel * PATH_MIN_TEXELS
      ? runsIn(world, fromX * texel, fromY * texel, (fromX + width) * texel, (fromY + height) * texel)
      : { runs: [], junctions: [] };
  const { runs, junctions } = paved;
  const reaches = reachesOver(
    world,
    sheet,
    texel,
    fromX * texel,
    fromY * texel,
    (fromX + width) * texel,
    (fromY + height) * texel,
  );
  const nearRow: Run[] = [];
  const nearJunctions: Junction[] = [];
  const nearReaches: Reach[] = [];

  for (let ty = 0; ty < height; ty += 1) {
    if (runs.length > 0 || junctions.length > 0) {
      nearRow.length = 0;
      nearJunctions.length = 0;
      const rowY = (fromY + ty + 0.5) * texel;
      for (const run of runs) if (rowY >= run.minY && rowY <= run.maxY) nearRow.push(run);
      for (const j of junctions) if (rowY >= j.minY && rowY <= j.maxY) nearJunctions.push(j);
    }

    if (reaches.length > 0) {
      nearReaches.length = 0;
      const rowY = (fromY + ty + 0.5) * texel;
      for (const reach of reaches) if (rowY >= reach.minY && rowY <= reach.maxY) nearReaches.push(reach);
    }

    for (let tx = 0; tx < width; tx += 1) {
      const ix = fromX + tx;
      const iy = fromY + ty;
      const x = (ix + 0.5) * texel;
      const y = (iy + 0.5) * texel;

      const column = Math.floor(x / spacing) - lattice.firstColumn;
      const row = Math.floor(y / spacing) - lattice.firstRow;

      const current = nearReaches.length > 0 ? riverDepthAt(nearReaches, x, y, world.seed) : -1;

      const flooded = floodedAt(level, x, y, smooth, world.seed);
      if (flooded !== Water.None) {
        const bed = level.height[waterCell(level, x, y)]!;

        const fresh =
          current < 0 || flooded === Water.Lake ? 0 : plume(bed) * (0.4 + 0.6 * current);

        const shade = step(bed, x, y, texel, world.seed);
        const ramp =
          fresh > threshold(ix, iy)
            ? RAMP_INDEX[Biome.River]
            : RAMP_INDEX[flooded === Water.Lake ? Biome.Lake : Biome.Ocean];
        paint(ty * width + tx, ramp, shade, ix, iy);
        continue;
      }

      let near = -1;
      let nearGap = Infinity;
      let next = -1;
      let nextGap = Infinity;

      for (let dy = -1; dy <= 1; dy += 1) {
        const r = row + dy;
        if (r < 0 || r >= lattice.rows) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const c = column + dx;
          if (c < 0 || c >= lattice.columns) continue;
          const at = r * lattice.columns + c;
          if (lattice.wet[at] === 1) continue;
          const ox = lattice.x[at]! - x;
          const oy = lattice.y[at]! - y;
          const gap = ox * ox + oy * oy;
          if (gap < nearGap) {
            next = near;
            nextGap = nearGap;
            near = at;
            nearGap = gap;
          } else if (gap < nextGap) {
            next = at;
            nextGap = gap;
          }
        }
      }

      if (nextGap > settled) for (let dy = -2; dy <= 2; dy += 1) {
        const r = row + dy;
        if (r < 0 || r >= lattice.rows) continue;
        for (let dx = -2; dx <= 2; dx += 1) {
          if (dx > -2 && dx < 2 && dy > -2 && dy < 2) continue;
          const c = column + dx;
          if (c < 0 || c >= lattice.columns) continue;
          const at = r * lattice.columns + c;
          if (lattice.wet[at] === 1) continue;
          const ox = lattice.x[at]! - x;
          const oy = lattice.y[at]! - y;
          const gap = ox * ox + oy * oy;
          if (gap < nearGap) {
            next = near;
            nextGap = nearGap;
            near = at;
            nearGap = gap;
          } else if (gap < nextGap) {
            next = at;
            nextGap = gap;
          }
        }
      }

      if (near < 0) {
        for (let dy = -2; dy <= 2 && near < 0; dy += 1) {
          const r = row + dy;
          if (r < 0 || r >= lattice.rows) continue;
          for (let dx = -2; dx <= 2; dx += 1) {
            const c = column + dx;
            if (c < 0 || c >= lattice.columns) continue;
            const at = r * lattice.columns + c;
            const ox = lattice.x[at]! - x;
            const oy = lattice.y[at]! - y;
            const gap = ox * ox + oy * oy;
            if (gap < nearGap) {
              near = at;
              nearGap = gap;
            }
          }
        }
        next = -1;
      }

      if (near < 0) continue;

      let at = near;
      if (next >= 0) {
        const edge = (Math.sqrt(nextGap) - Math.sqrt(nearGap)) / 2;
        const blend = Math.max(0, 1 - edge / fade) / 2;
        const over = sprites
          ? seam(sprites, lattice.biome[near]!, lattice.biome[next]!, blend, mip, ix, iy)
          : threshold(ix, iy) < blend;
        if (over) at = next;
      }

      if (current >= 0) {
        const bed = level.height[waterCell(level, x, y)]!;
        paint(ty * width + tx, RAMP_INDEX[Biome.River], step(bed, x, y, texel, world.seed), ix, iy);
        continue;
      }

      if (nearRow.length > 0 || nearJunctions.length > 0) {
        let worn = -Infinity;
        for (const run of nearRow) worn = Math.max(worn, (run.half - Math.sqrt(gapTo(run, x, y))) / band);

        for (const j of nearJunctions) {
          if (inside(j, x, y)) {
            worn = 1;
            break;
          }
        }

        const edgeAt = sprites ? maskAt(sprites, 'path', mip, ix, iy) / 255 : threshold(ix, iy);
        if (worn > edgeAt) {
          const shade = sprites
            ? textureStep(sprites, 'path', mip, ix, iy, x, y, world.seed) / (sprites.steps - 1)
            : pathShade(x, y, world.seed);
          paint(ty * width + tx, pathRampOf(lattice.biome[at]!), shade, ix, iy);
          continue;
        }
      }

      const material = sprites ? MATERIAL_BY_RAMP[lattice.biome[at]!] : null;
      const grain =
        sprites && material
          ? textureStep(sprites, material, mip, ix, iy, x, y, world.seed) / (sprites.steps - 1) +
            (lattice.elevation[at]! - 0.5) * 0.4
          : step(lattice.elevation[at]!, x, y, texel, world.seed);
      paint(ty * width + tx, lattice.biome[at]!, grain + relief(level, x, y, lit), ix, iy);
    }
  }

  if (sprites) stampDecals(world, sprites, mip, texel, fromX, fromY, width, height, { out, grounds, steps });
  return out;
}

const WATER_SHADE = 2;
const ripple = (ix: number, iy: number): boolean => iy % 3 === 0 && ((ix + Math.floor(iy / 3) * 2) % 5 + 5) % 5 < 3;

function stampDecals(
  world: GameWorld,
  sprites: GroundSprites,
  mip: number,
  texel: number,
  fromX: number,
  fromY: number,
  width: number,
  height: number,
  ground: { out: Uint32Array; grounds: Uint8Array; steps: Uint8Array },
): void {
  const bounds = { minX: fromX * texel, minY: fromY * texel, maxX: (fromX + width) * texel, maxY: (fromY + height) * texel };
  const live = mip < LIVE_MIPS;

  const lay = (placement: Placement, shadowsOnly: boolean): void => {
    const cells = decalCells(placement.decal, mip);
    const left = Math.round(placement.x / texel) - cells.foot.x - fromX;
    const top = Math.round(placement.y / texel) - cells.foot.y - fromY;
    if (left + cells.width <= 0 || top + cells.height <= 0 || left >= width || top >= height) return;
    if (!placement.decal.stands) {
      const fx = left + cells.foot.x;
      const fy = top + cells.foot.y;
      if (fx >= 0 && fy >= 0 && fx < width && fy < height && isPathRamp(ground.grounds[fy * width + fx]!)) return;
    }

    for (let cy = 0; cy < cells.height; cy += 1) {
      const ty = top + cy;
      if (ty < 0 || ty >= height) continue;
      for (let cx = 0; cx < cells.width; cx += 1) {
        const tx = left + cx;
        if (tx < 0 || tx >= width) continue;
        const cell = cells.cells[cy * cells.width + cx]!;
        const alpha = cell & 0xff;
        if (alpha === 0) continue;
        const at = ty * width + tx;
        if (alpha === 0xff) {
          if (!shadowsOnly) ground.out[at] = cell;
          continue;
        }

        const ramp = ground.grounds[at]!;
        const colors = GROUND_RAMPS[ramp]!;
        if (WATER_RAMPS.has(ramp)) {
          const ix = fromX + tx;
          const iy = fromY + ty;
          if (!ripple(ix, iy)) ground.out[at] = colors[Math.max(0, ground.steps[at]! - WATER_SHADE)] ?? 0;
        } else {
          ground.out[at] = colors[alpha - 1] ?? colors[0] ?? 0;
        }
      }
    }
  };

  if (mip === 0) for (const placement of placementsIn(world, sprites, bounds, false)) lay(placement, false);
  for (const placement of placementsIn(world, sprites, bounds, true)) lay(placement, live);
}
