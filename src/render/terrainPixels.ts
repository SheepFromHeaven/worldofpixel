import type { Rgba } from '../pixel/color.ts';
import type { Bounds } from '../sim/geometry.ts';
import { NOWHERE, TILE } from '../sim/grid.ts';
import { cliffOf, metresOf } from '../sim/steep.ts';
import { riverWidths } from '../sim/terrain/riverWidth.ts';
import { Water } from '../sim/terrain/hydrology.ts';
import type { WorldField } from '../sim/terrain/worldfield.ts';
import { reachesIn, SEA_LEVEL } from '../sim/terrain/worldfield.ts';
import { Biome } from '../sim/types.ts';
import type { World } from '../sim/world.ts';
import { WEAR_FULL } from '../sim/world.ts';
import { mouthAt } from './caveMouths.ts';
import type { GroundSprites, Material, Placement } from './groundSprites.ts';
import {
  decalCells,
  groundSprites,
  groundVersion,
  MATERIALS,
  MIPS,
  placementsIn,
  RIDGES,
  propsLit,
} from './groundSprites.ts';
import { BIOME_RAMPS, CAVE_MOUTH, PATH_RAMPS, ROCK_COLORS } from './palette.ts';
import { geologyOf } from '../sim/geology/geology.ts';

export const TEXELS_PER_TILE = 16;

export const TEXEL = TILE / TEXELS_PER_TILE;

export type Detail = 'fine' | 'medium' | 'coarse' | 'vast';

export interface GroundLevel {
  detail: Detail;
  texel: number;
  texels: number;
  cells: number;
}

const CHUNK_TEXELS = 256;

const DETAILS: readonly Detail[] = [
  'vast',
  'vast',
  'vast',
  'coarse',
  'coarse',
  'medium',
  'medium',
  'fine',
  'fine',
];

export const LEVELS: readonly GroundLevel[] = DETAILS.map((detail, rung) => {
  const texel = TEXEL * 2 ** (DETAILS.length - 1 - rung);
  return { detail, texel, texels: TILE / texel, cells: (CHUNK_TEXELS * texel) / TILE };
});

export const MIN_TEXEL_PIXELS = 2;

export function levelFor(zoom: number): GroundLevel {
  for (let i = LEVELS.length - 1; i > 0; i -= 1) {
    if (LEVELS[i]!.texel * zoom >= MIN_TEXEL_PIXELS) return LEVELS[i]!;
  }
  return LEVELS[0]!;
}

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

const RAMPS: readonly (readonly Rgba[])[] = BIOME_RAMPS;

const ROCK_TONES = [0.42, 0.6, 0.8, 1, 1.18];

const rockRamp = (hex: string): readonly Rgba[] => {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return ROCK_TONES.map((tone) => {
    const [r, g, b] = channels.map((channel) => Math.min(255, Math.round(channel * tone)));
    return (((r! << 24) | (g! << 16) | (b! << 8) | 255) >>> 0);
  });
};

const GROUND_RAMPS: readonly (readonly Rgba[])[] = [
  ...RAMPS,
  PATH_RAMPS.Meadow,
  PATH_RAMPS.Forest,
  PATH_RAMPS.Highland,
  PATH_RAMPS.Marsh,
  PATH_RAMPS.Tundra,
  PATH_RAMPS.Desert,
  PATH_RAMPS.Rock,
  PATH_RAMPS.Karst,
  PATH_RAMPS.Volcanic,
  PATH_RAMPS.Salt,
  PATH_RAMPS.Badlands,
  ...ROCK_COLORS.map(rockRamp),
];

const ROCK_RAMP_BASE = GROUND_RAMPS.length - ROCK_COLORS.length;

const pathRampOf = (biome: number): number => RAMPS.length + (biome < Biome.Ocean ? biome : 0);
const isPathRamp = (ramp: number): boolean => ramp >= RAMPS.length;
const isWetRamp = (biome: number): boolean => biome >= Biome.Ocean;

const WATER_RAMPS = new Set<number>([Biome.Ocean, Biome.Lake, Biome.River]);

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
  biome: Uint8Array;
}

const RELIEF = 0.45;
const RELIEF_SLOPE = 0.0135;

const BROAD = 7;

function waterCell(frame: CellFrame, x: number, y: number): number {
  let column = Math.floor((x - frame.minX) / frame.spacing);
  let row = Math.floor((y - frame.minY) / frame.spacing);
  column = column < 0 ? 0 : column >= frame.columns ? frame.columns - 1 : column;
  row = row < 0 ? 0 : row >= frame.rows ? frame.rows - 1 : row;
  return row * frame.columns + column;
}

function heightAt(level: FieldLevel, x: number, y: number): number {
  const fx = (x - level.minX) / level.spacing - 0.5;
  const fy = (y - level.minY) / level.spacing - 0.5;
  const left = Math.floor(fx);
  const top = Math.floor(fy);
  const u = fx - left;
  const v = fy - top;
  const last = level.columns - 1;
  const bottom = level.rows - 1;
  const c0 = left < 0 ? 0 : left > last ? last : left;
  const c1 = left + 1 < 0 ? 0 : left + 1 > last ? last : left + 1;
  const r0 = top < 0 ? 0 : top > bottom ? bottom : top;
  const r1 = top + 1 < 0 ? 0 : top + 1 > bottom ? bottom : top + 1;
  const { height, columns } = level;
  const upper = height[r0 * columns + c0]! + (height[r0 * columns + c1]! - height[r0 * columns + c0]!) * u;
  const lower = height[r1 * columns + c0]! + (height[r1 * columns + c1]! - height[r1 * columns + c0]!) * u;
  return upper + (lower - upper) * v;
}

const BED_SOFT_TILES = 7;
const BED_WEIGHT = 0.12;
const WATER_CALM = 0.3;

function softHeightAt(level: FieldLevel, x: number, y: number): number {
  const reach = BED_SOFT_TILES * TILE;
  return (
    (heightAt(level, x, y) * 2 +
      heightAt(level, x + reach, y) +
      heightAt(level, x - reach, y) +
      heightAt(level, x, y + reach) +
      heightAt(level, x, y - reach)) /
    6
  );
}

const CLIFF_SPAN = 0.75;
const CLIFF_MIN_SPACING = TILE * 2;
const WALL_FROM = 0.9;
const SCREE_FROM = 0.4;
const RIM_REACH = 7;
const RIM_DEEP = 260;
const SUN_STEPS = 5;
const SUN_STEP = 1.5;
const SUN_RISE = 70;
const CLIFF_SCAN_TILES = 8;
const CLIFF_SCAN_FROM = 100;

const DIRECTIONS: readonly (readonly [number, number])[] = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [
  Math.cos((k * Math.PI) / 4),
  Math.sin((k * Math.PI) / 4),
]);

interface Face {
  cliff: number;
  facing: number;
  metres: number;
  depth: number;
  shadow: number;
}

const FACE: Face = { cliff: 0, facing: 0, metres: 0, depth: 0, shadow: 0 };

function faceAt(level: FieldLevel, x: number, y: number): Face {
  const span = CLIFF_SPAN * TILE;
  const here = metresOf(heightAt(level, x, y));
  const dx = (metresOf(heightAt(level, x + span, y)) - metresOf(heightAt(level, x - span, y))) / (2 * span);
  const dy = (metresOf(heightAt(level, x, y + span)) - metresOf(heightAt(level, x, y - span))) / (2 * span);
  const steep = Math.hypot(dx, dy);
  FACE.cliff = cliffOf(steep);
  FACE.facing = steep > 0 ? (dx + dy) / (steep * Math.SQRT2) : 0;
  FACE.metres = here;

  let rim = here;
  for (const [ox, oy] of DIRECTIONS) {
    const around = metresOf(heightAt(level, x + ox * RIM_REACH * TILE, y + oy * RIM_REACH * TILE));
    if (around > rim) rim = around;
  }
  const t = Math.min(1, (rim - here) / RIM_DEEP);
  FACE.depth = t * t * (3 - 2 * t);

  let shadow = 0;
  for (let k = 1; k <= SUN_STEPS; k += 1) {
    const reach = k * SUN_STEP * TILE;
    const toward = metresOf(heightAt(level, x - reach * Math.SQRT1_2, y - reach * Math.SQRT1_2)) - here;
    shadow = Math.max(shadow, toward / (reach * SUN_RISE));
  }
  FACE.shadow = Math.min(1, Math.max(0, shadow));
  return FACE;
}

function cliffNear(world: World, bounds: Bounds): boolean {
  const { grid, steep } = world;
  const first = Math.max(0, Math.floor((bounds.minX - grid.minX) / grid.spacing) - CLIFF_SCAN_TILES);
  const last = Math.min(grid.columns - 1, Math.ceil((bounds.maxX - grid.minX) / grid.spacing) + CLIFF_SCAN_TILES);
  const top = Math.max(0, Math.floor((bounds.minY - grid.minY) / grid.spacing) - CLIFF_SCAN_TILES);
  const bottom = Math.min(grid.rows - 1, Math.ceil((bounds.maxY - grid.minY) / grid.spacing) + CLIFF_SCAN_TILES);
  for (let row = top; row <= bottom; row += 1) {
    for (let column = first; column <= last; column += 1) {
      if (steep[row * grid.columns + column]! >= CLIFF_SCAN_FROM) return true;
    }
  }
  return false;
}

function slopeToward(level: FieldLevel, x: number, y: number, span: number): number {
  const toward = heightAt(level, x - span, y - span);
  const away = heightAt(level, x + span, y + span);

  return (away - toward) / (span * 2 * Math.SQRT2);
}

function relief(level: FieldLevel, x: number, y: number, span: number): number {
  const local = slopeToward(level, x, y, span);
  const broad = slopeToward(level, x, y, span * BROAD);
  return Math.max(-1, Math.min(1, (local - broad) / RELIEF_SLOPE)) * RELIEF;
}

const BLOTCH = TILE * 6.5;
const GRAIN_TEXELS = 13.4;

const BLOTCH_MIN_TEXELS = 6;

function step(elevation: number, x: number, y: number, texel: number, seed: number, calm = 1): number {
  const blotch = Math.max(BLOTCH, texel * BLOTCH_MIN_TEXELS);
  const paper = texel * GRAIN_TEXELS;
  const coarse = mottle(x / blotch, y / blotch, seed + 101);
  const fine = mottle(x / paper, y / paper, seed + 211);
  const grain = coarse * 0.3 + fine * 0.7;
  const height = (elevation - 0.5) * 0.55;

  return (grain - 0.5) * 0.42 * calm + 0.21 + height + 0.32;
}

const mips: FieldLevel[] = [];
let mipSeed: number | null = null;

const MAX_MIP = 8;

function fieldLevel(world: World, texel: number): FieldLevel {
  if (mipSeed !== world.seed) {
    mips.length = 0;
    mipSeed = world.seed;
  }

  const { grid, field } = world;

  if (mips.length === 0) {
    mips.push({
      columns: grid.columns,
      rows: grid.rows,
      minX: grid.minX,
      minY: grid.minY,
      spacing: grid.spacing,
      water: field.water,
      height: field.height,
      biome: world.biome,
    });
  }

  const want = Math.min(MAX_MIP, Math.max(0, Math.round(Math.log2(texel / grid.spacing))));

  while (mips.length <= want) {
    const under = mips[mips.length - 1]!;
    const columns = Math.max(1, under.columns >> 1);
    const rows = Math.max(1, under.rows >> 1);
    const water = new Uint8Array(columns * rows);
    const height = new Float32Array(columns * rows);
    const biome = new Uint8Array(columns * rows);
    const tally = new Uint8Array(RAMPS.length);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        let ocean = 0;
        let lake = 0;
        let bed = 0;
        let taken = 0;
        tally.fill(0);

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
            else {
              const kinds = under.biome[at]!;
              tally[kinds] = tally[kinds]! + 1;
            }
            bed += under.height[at]!;
            taken += 1;
          }
        }

        const wet = ocean + lake < 2 ? Water.None : ocean >= lake ? Water.Ocean : Water.Lake;
        const at = row * columns + column;
        water[at] = wet;
        height[at] = taken === 0 ? 0 : bed / taken;

        if (wet === Water.Ocean) biome[at] = Biome.Ocean;
        else if (wet === Water.Lake) biome[at] = Biome.Lake;
        else {
          let best = Biome.Meadow as number;
          let most = 0;
          for (let kind = 0; kind < tally.length; kind += 1) {
            if (tally[kind]! > most) {
              most = tally[kind]!;
              best = kind;
            }
          }
          biome[at] = most === 0 ? (ocean >= lake ? Biome.Ocean : Biome.Lake) : best;
        }
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
      biome,
    });
  }

  return mips[want]!;
}

const SHORE_WANDER = 0.8;

const SHORE = { edge: Number.NaN, kind: 0 };

const wetSign = (level: FieldLevel, column: number, row: number): number => {
  const c = column < 0 ? 0 : column >= level.columns ? level.columns - 1 : column;
  const r = row < 0 ? 0 : row >= level.rows ? level.rows - 1 : row;
  return level.water[r * level.columns + c]! === Water.None ? -1 : 1;
};

function floodedAt(level: FieldLevel, x: number, y: number, smooth: boolean, seed: number): number {
  const at = waterCell(level, x, y);
  const here = level.water[at]!;
  SHORE.edge = Number.NaN;
  if (!smooth) return here;

  const column = at % level.columns;
  const row = (at - column) / level.columns;
  let shore = false;
  let wetKind: number = Water.None;
  for (let r = row - 1; r <= row + 1; r += 1) {
    if (r < 0 || r >= level.rows) continue;
    for (let c = column - 1; c <= column + 1; c += 1) {
      if (c < 0 || c >= level.columns) continue;
      const found = level.water[r * level.columns + c]!;
      if (found !== here) shore = true;
      if (found !== Water.None) wetKind = found;
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

  SHORE.edge = (surface - wobble) * level.spacing * 0.5;
  SHORE.kind = wetKind;

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

interface Reach {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  half: number;
  halfEnd: number;
  minY: number;
  maxY: number;
  fan: boolean;
}

const REACH_MIN_TEXELS = 0.9;

const WIDTH_SWELL = 0.3;

const MOUTH_SEEK = 4;
const MOUTH_STEP = 0.25;
const MOUTH_OVERLAP = 0.5;

function waterAt(field: WorldField, x: number, y: number): Water {
  const at = field.grid.atPoint({ x, y });
  return at === NOWHERE ? Water.None : (field.water[at]! as Water);
}

const DELTA_STEPS = 3;
const DELTA_STEP = 1.1;
const DELTA_SPREAD = 1.5;

function reachesOver(world: World, texel: number, bounds: Bounds): Reach[] {
  const reaches: Reach[] = [];
  const { field } = world;

  const widths = riverWidths(field.rivers.segments);
  for (const run of reachesIn(field, bounds)) {
    if (run.half * 2 < texel * REACH_MIN_TEXELS) continue;
    const [startHalf, endHalf] = widths.get(run) ?? [run.half, run.half];
    const widest = Math.max(startHalf, endHalf) * (1 + WIDTH_SWELL);

    const dx = run.bx - run.ax;
    const dy = run.by - run.ay;
    const along = Math.hypot(dx, dy);

    let endX = run.bx;
    let endY = run.by;
    let mouth = waterAt(field, endX, endY);
    if (mouth === Water.None && along > 0) {
      for (let step = MOUTH_STEP; step <= MOUTH_SEEK; step += MOUTH_STEP) {
        const x = run.bx + (dx / along) * step;
        const y = run.by + (dy / along) * step;
        const found = waterAt(field, x, y);
        if (found === Water.None) continue;
        mouth = found;
        endX = x + (dx / along) * endHalf * MOUTH_OVERLAP;
        endY = y + (dy / along) * endHalf * MOUTH_OVERLAP;
        break;
      }
    }

    reaches.push({
      ax: run.ax,
      ay: run.ay,
      bx: endX,
      by: endY,
      half: startHalf,
      halfEnd: endHalf,
      minY: Math.min(run.ay, endY) - widest - BANK_REACH,
      maxY: Math.max(run.ay, endY) + widest + BANK_REACH,
      fan: false,
    });

    if (mouth !== Water.Ocean || along === 0) continue;

    let fromX = endX;
    let fromY = endY;
    let half = run.half;
    for (let n = 0; n < DELTA_STEPS; n += 1) {
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
        halfEnd: half,
        minY: Math.min(fromY, toY) - half,
        maxY: Math.max(fromY, toY) + half,
        fan: true,
      });
      fromX = toX;
      fromY = toY;
    }
  }

  return reaches;
}

const BANK_WANDER = 0.45;

function bankOffset(x: number, y: number, bank: number, seed: number): number {
  const coarse = mottle(x / (bank * 2.4), y / (bank * 2.4), seed + 821);
  const fine = mottle(x / (bank * 0.8), y / (bank * 0.8), seed + 919);
  return (coarse * 0.62 + fine * 0.38 - 0.5) * 2 * bank * BANK_WANDER;
}

const PLUME = 0.022;

const plume = (bed: number): number =>
  Math.max(0, Math.min(1, (bed - (SEA_LEVEL - PLUME)) / PLUME));

function reachGap(reach: Reach, x: number, y: number, out: { width: number }): number {
  const dx = reach.bx - reach.ax;
  const dy = reach.by - reach.ay;
  const along = dx * dx + dy * dy;
  const t =
    along === 0 ? 0 : Math.max(0, Math.min(1, ((x - reach.ax) * dx + (y - reach.ay) * dy) / along));
  const px = reach.ax + dx * t - x;
  const py = reach.ay + dy * t - y;
  out.width = reach.half + (reach.halfEnd - reach.half) * t;
  return Math.sqrt(px * px + py * py);
}

interface RiverEdge {
  edge: number;
  half: number;
  fan: boolean;
  channelEdge: number;
  channelHalf: number;
}

const RIVER_EDGE: RiverEdge = { edge: Infinity, half: 1, fan: false, channelEdge: Infinity, channelHalf: 1 };

const SPAN = { width: 1 };

function swell(x: number, y: number, width: number, seed: number): number {
  const scale = width * 7 + 5;
  const slow = mottle(x / scale, y / scale, seed + 1201);
  const quick = mottle(x / (scale * 0.35), y / (scale * 0.35), seed + 1301);
  return 1 + (slow * 0.7 + quick * 0.3 - 0.5) * 2 * WIDTH_SWELL;
}

function riverAt(reaches: readonly Reach[], x: number, y: number, seed: number, out: RiverEdge): boolean {
  let best = Infinity;
  let bank = 1;
  let fan = false;
  let channel = Infinity;
  let channelBank = 1;

  for (const reach of reaches) {
    const gap = reachGap(reach, x, y, SPAN) - SPAN.width;
    if (!reach.fan && gap < channel) {
      channel = gap;
      channelBank = SPAN.width;
    }
    if (gap >= best) continue;
    best = gap;
    bank = SPAN.width;
    fan = reach.fan;
  }
  if (best === Infinity) return false;

  const sized = fan ? 0 : bank * (swell(x, y, bank, seed) - 1);
  out.edge = best - sized - bankOffset(x, y, bank, seed);
  out.half = bank;
  out.fan = fan;
  if (channel === Infinity) {
    out.channelEdge = Infinity;
  } else {
    out.channelEdge = channel - channelBank * (swell(x, y, channelBank, seed) - 1) - bankOffset(x, y, channelBank, seed);
    out.channelHalf = channelBank;
  }
  return true;
}

const ease = (low: number, high: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

const BANK_REACH = TILE;

const SHALLOWS_TILES = 0.9;

const MUD = RAMPS.length + Biome.Marsh;

const SAND = RAMPS.length + Biome.Desert;

export function riverShade(depth: number, half: number): number {
  const size = ease(0.3, 3, half);
  const deep = depth ** 0.7 * (0.4 + 0.6 * size);
  return 0.8 - 0.62 * deep;
}

interface Bank {
  wet: number;
  sandy: boolean;
}

const BANK: Bank = { wet: 0, sandy: false };

export function riverBank(half: number): { band: number; sandy: boolean } {
  const size = ease(0.3, 3, half);
  const shallow = size < 0.5;
  return { band: shallow ? 0.12 + 0.2 * (1 - size * 2) : 0.2 + 0.3 * size, sandy: shallow };
}

function bankAt(river: boolean, riverEdge: number, riverHalf: number, shoreTiles: number, shoreKind: number): Bank {
  let wet = 0;
  let sandy = false;

  if (river && riverEdge >= 0) {
    const { band, sandy: gravel } = riverBank(riverHalf);
    if (riverEdge < band) {
      wet = 1 - riverEdge / band;
      sandy = gravel;
    }
  }

  if (Number.isFinite(shoreTiles)) {
    const beach = shoreKind === Water.Ocean;
    const band = beach ? 0.7 : 0.5;
    if (shoreTiles < band && 1 - shoreTiles / band > wet) {
      wet = 1 - shoreTiles / band;
      sandy = beach;
    }
  }

  BANK.wet = wet;
  BANK.sandy = sandy;
  return BANK;
}

function pathShade(x: number, y: number, seed: number): number {
  const coarse = mottle(x / (TILE * 3.4), y / (TILE * 3.4), seed + 401);
  const fine = mottle(x / (TILE * 1.1), y / (TILE * 1.1), seed + 509);
  return coarse * 0.55 + fine * 0.45;
}

export function chunkKey(world: World, rung: number, column: number, row: number, bounds: Bounds): string {
  return `${world.seed}:${rung}:${column}:${row}:${world.stampOver(bounds)}:${groundVersion()}`;
}

const VARIANT_SPAN = TILE * 11;
const RIDGE_SPAN = TILE * 52;

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
  const ridge =
    RIDGES[
      Math.min(
        RIDGES.length - 1,
        Math.floor(mottle(x / RIDGE_SPAN, y / RIDGE_SPAN, seed + 811) * RIDGES.length),
      )
    ];
  const list = sprites.variants.get(material === 'desert' ? `desert:${ridge}` : material);
  if (!list || list.length === 0) return 2;
  const v = mottle(x / VARIANT_SPAN, y / VARIANT_SPAN, seed + 701) * list.length;
  let pick = Math.min(list.length - 1, Math.floor(v));
  const t = v - Math.floor(v);
  if (t > 0.8 && pick + 1 < list.length && maskAt(sprites, material, mip, ix, iy) < ((t - 0.8) / 0.2) * 255) {
    pick += 1;
  }
  const cells = list[pick]!.mips[mip]!;
  const size = sprites.size >> mip;
  return cells[(((iy % size) + size) % size) * size + (((ix % size) + size) % size)]!;
}

function seam(
  sprites: GroundSprites,
  near: number,
  next: number,
  blend: number,
  mip: number,
  ix: number,
  iy: number,
): boolean {
  const a = MATERIALS[near];
  const b = MATERIALS[next];
  if (!a || !b) return threshold(ix, iy) < blend;
  if (a === b) return maskAt(sprites, a, mip, ix, iy) < blend * 255;
  const nextHigh = sprites.priority.indexOf(b) < sprites.priority.indexOf(a);
  const reach = nextHigh ? blend : 1 - blend;
  const takeHigh = maskAt(sprites, nextHigh ? b : a, mip, ix, iy) < reach * 255;
  return takeHigh === nextHigh;
}

const PATH_SHOWS = 24;
const PATH_MIN_TEXELS = 2;

function wearAt(world: World, column: number, row: number, u: number, v: number): number {
  const { grid, wear } = world;
  const left = u < 0.5 ? column - 1 : column;
  const top = v < 0.5 ? row - 1 : row;
  const fx = u < 0.5 ? u + 0.5 : u - 0.5;
  const fy = v < 0.5 ? v + 0.5 : v - 0.5;

  const read = (c: number, r: number): number =>
    grid.holds(c, r) ? wear[r * grid.columns + c]! : 0;

  const above = read(left, top) + (read(left + 1, top) - read(left, top)) * fx;
  const below = read(left, top + 1) + (read(left + 1, top + 1) - read(left, top + 1)) * fx;
  return above + (below - above) * fy;
}

export function texelsIn(
  world: World,
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
    const tone = rampStep(colors, shade, ix, iy);
    out[at] = colors[tone] ?? 0;
    grounds[at] = ramp;
    steps[at] = tone;
  };

  const mip = Math.round(Math.log2(texel / TEXEL));
  const loaded = groundSprites();
  const sprites = loaded && mip >= 0 && mip < MIPS ? loaded : null;

  const { grid } = world;
  const level = fieldLevel(world, texel);

  const lit = Math.max(level.spacing, TILE * 2);
  const smooth = level.spacing > texel;

  const bounds: Bounds = {
    minX: fromX * texel,
    minY: fromY * texel,
    maxX: (fromX + width) * texel,
    maxY: (fromY + height) * texel,
  };

  const cliffs = smooth && level.spacing <= CLIFF_MIN_SPACING && cliffNear(world, bounds);

  const paths = TILE >= texel * PATH_MIN_TEXELS;
  const reaches = reachesOver(world, texel, bounds);
  const nearReaches: Reach[] = [];

  for (let ty = 0; ty < height; ty += 1) {
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
      const at = ty * width + tx;

      let beside = nearReaches.length > 0 && riverAt(nearReaches, x, y, world.seed, RIVER_EDGE);
      let current = beside && RIVER_EDGE.edge < 0 ? Math.min(1, -RIVER_EDGE.edge / RIVER_EDGE.half) : -1;

      const flooded = floodedAt(level, x, y, smooth, world.seed);
      if (beside && flooded === Water.Lake) {
        beside = false;
        current = -1;
      } else if (beside && RIVER_EDGE.fan && flooded !== Water.Ocean) {
        if (RIVER_EDGE.channelEdge === Infinity) {
          beside = false;
          current = -1;
        } else {
          RIVER_EDGE.edge = RIVER_EDGE.channelEdge;
          RIVER_EDGE.half = RIVER_EDGE.channelHalf;
          RIVER_EDGE.fan = false;
          current = RIVER_EDGE.edge < 0 ? Math.min(1, -RIVER_EDGE.edge / RIVER_EDGE.half) : -1;
        }
      }
      const shoreTiles = Number.isNaN(SHORE.edge) ? Infinity : SHORE.edge;
      const shoreKind = SHORE.kind;
      if (flooded !== Water.None) {
        const bed = softHeightAt(level, x, y);
        const fresh = current < 0 || flooded === Water.Lake ? 0 : plume(bed) * (0.4 + 0.6 * current);
        const ramp =
          fresh > threshold(ix, iy) ? Biome.River : flooded === Water.Lake ? Biome.Lake : Biome.Ocean;
        if (current >= 0) {
          const grain = (step(0.5, x, y, texel, world.seed, WATER_CALM) - 0.53) * 0.5;
          paint(at, ramp, riverShade(current, RIVER_EDGE.half) + grain, ix, iy);
          continue;
        }
        const shallows = Number.isFinite(shoreTiles) && !beside ? 1 - ease(0, SHALLOWS_TILES, shoreTiles) : 0;
        paint(at, ramp, step(0.5 + (bed - 0.5) * BED_WEIGHT, x, y, texel, world.seed, WATER_CALM) + 0.3 * shallows, ix, iy);
        continue;
      }

      const fx = (x - level.minX) / level.spacing - 0.5;
      const fy = (y - level.minY) / level.spacing - 0.5;
      const left = Math.floor(fx);
      const top = Math.floor(fy);
      const u = fx - left;
      const v = fy - top;

      const hold = (c: number, r: number): number => {
        const cc = c < 0 ? 0 : c >= level.columns ? level.columns - 1 : c;
        const rr = r < 0 ? 0 : r >= level.rows ? level.rows - 1 : r;
        return rr * level.columns + cc;
      };

      const corners = [hold(left, top), hold(left + 1, top), hold(left, top + 1), hold(left + 1, top + 1)];
      const weights = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v];

      let cell = corners[0]!;
      let heaviest = weights[0]!;
      for (let k = 1; k < 4; k += 1) {
        if (weights[k]! > heaviest) {
          heaviest = weights[k]!;
          cell = corners[k]!;
        }
      }
      const mine = level.biome[cell]!;

      if (current >= 0) {
        const grain = (step(0.5, x, y, texel, world.seed, WATER_CALM) - 0.53) * 0.5;
        paint(at, Biome.River, riverShade(current, RIVER_EDGE.half) + grain, ix, iy);
        continue;
      }

      let rival = -1;
      let blend = 0;
      for (let k = 0; k < 4; k += 1) {
        const next = level.biome[corners[k]!]!;
        if (next === mine || isWetRamp(next)) continue;
        if (weights[k]! > blend) {
          blend = weights[k]!;
          rival = corners[k]!;
        }
      }

      if (rival >= 0 && blend > 0) {
        const over = sprites
          ? seam(sprites, mine, level.biome[rival]!, blend, mip, ix, iy)
          : threshold(ix, iy) < blend;
        if (over) cell = rival;
      }

      const ground = level.biome[cell]!;

      if (paths) {
        const tx0 = (x - grid.minX) / grid.spacing;
        const ty0 = (y - grid.minY) / grid.spacing;
        const worn = wearAt(world, Math.floor(tx0), Math.floor(ty0), tx0 % 1, ty0 % 1);
        if (worn >= PATH_SHOWS) {
          const edge = sprites ? maskAt(sprites, 'path', mip, ix, iy) / 255 : threshold(ix, iy);
          if (worn / WEAR_FULL > edge * 0.9) {
            const shade = sprites
              ? textureStep(sprites, 'path', mip, ix, iy, x, y, world.seed) / (sprites.steps - 1)
              : pathShade(x, y, world.seed);
            paint(at, pathRampOf(ground), shade, ix, iy);
            continue;
          }
        }
      }

      if (smooth) {
        const mouth = mouthAt(world, x, y);
        if (mouth > 0.22) {
          const deep = Math.min(3, Math.floor((mouth - 0.22) * 5 + threshold(ix, iy) * 0.9));
          out[at] = CAVE_MOUTH[deep === 3 ? 0 : 2 - deep] ?? CAVE_MOUTH[0];
          grounds[at] = pathRampOf(ground);
          steps[at] = 0;
          continue;
        }
        if (mouth > 0) {
          const lit = mouthAt(world, x + 0.3, y + 0.3) > mouth;
          if (lit) {
            paint(at, ground, 0.85 + (threshold(ix, iy) - 0.5) * 0.2, ix, iy);
          } else {
            out[at] = CAVE_MOUTH[threshold(ix, iy) < 0.5 ? 2 : 3];
            grounds[at] = pathRampOf(ground);
            steps[at] = 0;
          }
          continue;
        }
      }

      const elevation = level.height[cell]!;
      const material = sprites ? MATERIALS[ground] : null;
      const grain =
        sprites && material
          ? textureStep(sprites, material, mip, ix, iy, x, y, world.seed) / (sprites.steps - 1) +
            (elevation - 0.5) * 0.4
          : step(elevation, x, y, texel, world.seed);

      const bank = bankAt(beside, RIVER_EDGE.edge, RIVER_EDGE.half, -shoreTiles, shoreKind);
      if (bank.wet > 0) {
        const wander = mottle(x / (texel * 7), y / (texel * 7), world.seed + 1301) * 0.6 + threshold(ix, iy) * 0.4;
        if (bank.wet - 0.45 > (wander - 0.5) * 1.1) {
          const shade = bank.sandy ? 0.45 + 0.4 * (1 - bank.wet) : 0.1 + 0.55 * (1 - bank.wet);
          paint(at, bank.sandy ? SAND : MUD, shade + (grain - 0.4) * 0.35, ix, iy);
          continue;
        }
        paint(at, ground, grain - 0.28 * bank.wet + relief(level, x, y, lit), ix, iy);
        continue;
      }

      if (cliffs) {
        const face = faceAt(level, x, y);
        const wobble = (mottle(x / (texel * 5), y / (texel * 5), world.seed + 1777) - 0.5) * 0.08 + (threshold(ix, iy) - 0.5) * 0.04;
        const wall = face.cliff > WALL_FROM + wobble;
        const scree = !wall && face.cliff > SCREE_FROM + (1 - SCREE_FROM) * 0.9 * threshold(ix, iy);
        if (wall || scree) {
          const grain = sprites && MATERIALS[Biome.Rock]
            ? textureStep(sprites, MATERIALS[Biome.Rock]!, mip, ix, iy, x, y, world.seed) / (sprites.steps - 1)
            : 0.5;
          const bed = geologyOf(world).bedAt(x, y, face.metres);
          const lip = wall && face.depth < 0.1 ? 0.2 : 0;
          const base = wall ? 0.72 - 0.32 * face.depth + 0.26 * face.facing : 0.62 + 0.18 * face.facing - 0.1 * face.depth;
          paint(at, ROCK_RAMP_BASE + bed, base + (grain - 0.5) * 0.22 + lip, ix, iy);
          continue;
        }
        const floor = 0.16 * face.depth + 0.3 * face.shadow;
        paint(at, ground, grain + relief(level, x, y, lit) - floor - 0.45 * face.cliff * face.cliff, ix, iy);
        continue;
      }

      paint(at, ground, grain + relief(level, x, y, lit), ix, iy);
    }
  }

  if (sprites) {
    stampDecals(world, sprites, mip, texel, fromX, fromY, width, height, { out, grounds, steps });
  }
  return out;
}

const WATER_SHADE = 2;

const ripple = (ix: number, iy: number): boolean =>
  iy % 3 === 0 && (((ix + Math.floor(iy / 3) * 2) % 5) + 5) % 5 < 3;

function stampDecals(
  world: World,
  sprites: GroundSprites,
  mip: number,
  texel: number,
  fromX: number,
  fromY: number,
  width: number,
  height: number,
  ground: { out: Uint32Array; grounds: Uint8Array; steps: Uint8Array },
): void {
  const bounds: Bounds = {
    minX: fromX * texel,
    minY: fromY * texel,
    maxX: (fromX + width) * texel,
    maxY: (fromY + height) * texel,
  };

  const lay = (placement: Placement, shadowsOnly: boolean): void => {
    const cells = decalCells(placement.decal, mip);
    const left = Math.round(placement.x / texel) - cells.foot.x - fromX;
    const top = Math.round(placement.y / texel) - cells.foot.y - fromY;
    if (left + cells.width <= 0 || top + cells.height <= 0 || left >= width || top >= height) return;

    if (!placement.decal.stands) {
      const fx = left + cells.foot.x;
      const fy = top + cells.foot.y;
      if (fx >= 0 && fy >= 0 && fx < width && fy < height && isPathRamp(ground.grounds[fy * width + fx]!)) {
        return;
      }
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

  if (propsLit()) return;
  if (mip === 0) for (const placement of placementsIn(world, sprites, bounds, false)) lay(placement, false);
  for (const placement of placementsIn(world, sprites, bounds, true)) lay(placement, false);
}
