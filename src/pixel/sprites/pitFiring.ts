import { and, blob, ellipse, not } from '../field.ts';
import type { Mask } from '../field.ts';
import { at, createGrid, outline, put, stamp } from '../grid.ts';
import type { Grid, Stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { CHAR, EARTH, FIRE, FOLIAGE, INK, PAPER, SHADOW, STONE, STONE_WARM } from '../palette.ts';
import { dome, flat, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Clip, Piece, Sprite } from '../sprite.ts';
import { TILE_CELLS, TILT, castShadow, groundShadow } from '../view.ts';

const CELLS = TILE_CELLS;

const CENTRE = { x: 15, y: 20 };
const RADIUS = 9;
const OPENING = blob(CENTRE.x, CENTRE.y, RADIUS, RADIUS * TILT, 0.1, 53);

const DEPTH = 4;

const FLOOR = and(OPENING, blob(CENTRE.x, CENTRE.y + DEPTH, RADIUS, RADIUS * TILT, 0.1, 53));
const WALL = and(OPENING, not(FLOOR));

const RIM_SHADOW = and(OPENING, not(blob(CENTRE.x + 3, CENTRE.y + 2, RADIUS, RADIUS * TILT, 0.1, 53)));

const LIP: Mask = (x, y) =>
  !OPENING(x, y) && y > CENTRE.y && (OPENING(x, y - 1) || OPENING(x - 1, y - 1) || OPENING(x + 1, y - 1));

const CLAY = STONE_WARM;

const jar: Stamp = [
  [-1, -7, CLAY[6]!], [0, -7, CLAY[6]!], [1, -7, CLAY[5]!],
  [-2, -6, INK], [-1, -6, CHAR[1]!], [0, -6, CHAR[0]!], [1, -6, CHAR[1]!], [2, -6, INK],
  [-2, -5, INK], [-1, -5, CLAY[5]!], [0, -5, CLAY[5]!], [1, -5, CLAY[3]!], [2, -5, INK],
  [-3, -4, INK], [-2, -4, CLAY[6]!], [-1, -4, CLAY[6]!], [0, -4, CLAY[5]!], [1, -4, CLAY[4]!], [2, -4, CLAY[3]!], [3, -4, INK],
  [-3, -3, INK], [-2, -3, CLAY[6]!], [-1, -3, CLAY[5]!], [0, -3, CLAY[5]!], [1, -3, CLAY[4]!], [2, -3, CLAY[3]!], [3, -3, INK],
  [-2, -2, INK], [-1, -2, CLAY[5]!], [0, -2, CLAY[4]!], [1, -2, CLAY[3]!], [2, -2, INK],
  [-2, -1, INK], [-1, -1, CLAY[4]!], [0, -1, CLAY[3]!], [1, -1, INK],
  [-1, 0, INK], [0, 0, INK], [1, 0, INK],
];

const crock: Stamp = [
  [-1, -5, CLAY[6]!], [0, -5, CLAY[5]!],
  [-2, -4, INK], [-1, -4, CHAR[0]!], [0, -4, CHAR[1]!], [1, -4, INK],
  [-2, -3, INK], [-1, -3, CLAY[6]!], [0, -3, CLAY[5]!], [1, -3, CLAY[3]!], [2, -3, INK],
  [-2, -2, INK], [-1, -2, CLAY[5]!], [0, -2, CLAY[4]!], [1, -2, CLAY[3]!], [2, -2, INK],
  [-2, -1, INK], [-1, -1, CLAY[4]!], [0, -1, CLAY[3]!], [1, -1, INK],
  [-1, 0, INK], [0, 0, INK], [1, 0, INK],
];

const POTS: readonly { x: number; y: number; stamp: Stamp }[] = [
  { x: 12, y: 22, stamp: crock },
  { x: 18, y: 25, stamp: jar },
];

const POT_FOOT = Math.max(...POTS.map((pot) => pot.y)) + 1;

const COVER_AT = { x: 10, y: 25 };
const COVER_WIDTH = 5.5;
const COVER_RISE = 4.5;
const COVER_REACH = COVER_WIDTH * TILT * 0.52;
const COVER: Mask = (x, y) => {
  const across = (x - COVER_AT.x) / COVER_WIDTH;
  if (Math.abs(across) > 1) return false;
  const ground = COVER_REACH * Math.sqrt(1 - across * across);
  const rise = COVER_RISE * (1 - across * across) ** 0.7;
  return y <= COVER_AT.y + ground && y >= COVER_AT.y - rise;
};

const SOD: Mask = (x, y) => COVER(x, y) && !COVER(x, y - 2) && y < COVER_AT.y;

const SCORCH = and(COVER, ellipse(COVER_AT.x + 0.5, COVER_AT.y - COVER_RISE + 1.5, 1.8, 1.3));

const COVER_REGIONS: readonly Region[] = [
  { mask: COVER, material: { ramp: EARTH, profile: dome, relief: 4, ambient: 0.34, contrast: 0.78, speckle: 0.32 } },
  { mask: SCORCH, material: { ramp: CHAR, profile: dome, relief: 2, ambient: 0.35, contrast: 0.45, speckle: 0.35 } },
  { mask: and(SOD, not(SCORCH)), material: { ramp: FOLIAGE, profile: flat, relief: 0, ambient: 0.42, contrast: 0.45, speckle: 0.4 } },
];

const EMBERS: [number, number][] = [[10, 22], [11, 22], [9, 21]];

const HEAP_AT = { x: 27, y: 14 };
const HEAP_WIDTH = 5;
const HEAP_HEIGHT = 5;
const HEAP: Mask = and(
  (x, y) => {
    const across = (x - HEAP_AT.x) / HEAP_WIDTH;
    if (Math.abs(across) > 1) return false;
    const ground = HEAP_WIDTH * TILT * 0.5 * Math.sqrt(1 - across * across);
    const hump = HEAP_HEIGHT * (1 - across * across) ** 0.8;
    return y <= HEAP_AT.y + ground && y >= HEAP_AT.y - hump;
  },
  not(OPENING),
);

const HEAP_REGIONS: readonly Region[] = [
  { mask: HEAP, material: { ramp: EARTH, profile: dome, relief: 4, ambient: 0.32, contrast: 0.95, speckle: 0.34 } },
];

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

const STONES: [number, number][] = [[15, 26], [22, 23]];
const CLODS: [number, number][] = [[29, 19], [3, 15], [5, 29], [22, 30]];
const SHERDS: [number, number][] = [[27, 27], [2, 22]];

const stone: Stamp = [
  [0, 0, STONE[4]!], [1, 0, STONE[2]!],
  [0, 1, STONE[1]!],
];

const clod: Stamp = [[0, 0, EARTH[4]!], [1, 0, EARTH[3]!], [0, 1, EARTH[2]!]];

const sherd: Stamp = [
  [0, 0, STONE_WARM[5]!], [1, 0, STONE_WARM[4]!], [2, 0, STONE_WARM[6]!],
  [0, 1, INK], [1, 1, STONE_WARM[2]!], [2, 1, INK],
];

function strata(grid: Grid): void {
  for (let y = 0; y < CELLS; y += 1) {
    for (let x = 0; x < CELLS; x += 1) {
      if (WALL(x, y) && (y - Math.round(CENTRE.y)) % 2 === 0) put(grid, x, y, EARTH[1]!);
    }
  }
}

const PIT_REGIONS: readonly Region[] = [
  { mask: WALL, material: { ramp: EARTH, profile: flat, relief: 0, ambient: 0.5, contrast: 0.2, speckle: 0.2 } },
  { mask: FLOOR, material: { ramp: CHAR, profile: flat, relief: 0, ambient: 0.5, contrast: 0.12, speckle: 0.3 } },
];

function floorOf(lights: readonly Light[]): Grid {
  const grid = createGrid(CELLS);
  for (const [x, y] of CLODS) if (!OPENING(x, y) && !HEAP(x, y)) stamp(grid, x, y, clod);
  for (const [x, y] of SHERDS) if (!OPENING(x, y) && !HEAP(x, y)) stamp(grid, x, y, sherd);

  const pit = shade(CELLS, PIT_REGIONS, lights);
  for (let y = 0; y < CELLS; y += 1) {
    for (let x = 0; x < CELLS; x += 1) if (OPENING(x, y)) put(grid, x, y, at(pit, x, y));
  }
  strata(grid);
  for (const [x, y] of STONES) if (FLOOR(x, y)) stamp(grid, x, y, stone);
  for (let y = 0; y < CELLS; y += 1) {
    for (let x = 0; x < CELLS; x += 1) {
      if (RIM_SHADOW(x, y)) put(grid, x, y, FLOOR(x, y) ? CHAR[0]! : EARTH[0]!);
    }
  }
  for (let y = 0; y < CELLS; y += 1) {
    for (let x = 0; x < CELLS; x += 1) if (LIP(x, y)) put(grid, x, y, EARTH[3]!);
  }
  return grid;
}

function potsOf(): Grid {
  const grid = createGrid(CELLS);
  for (const pot of POTS) stamp(grid, pot.x, pot.y, pot.stamp);
  return grid;
}

function coverOf(lights: readonly Light[]): Grid {
  const grid = shade(CELLS, COVER_REGIONS, lights);
  for (const [x, y] of EMBERS) if (SCORCH(x, y)) stamp(grid, x, y, [[0, 0, FIRE[6]!], [1, 0, FIRE[4]!]]);
  outline(grid, INK);
  castShadow(grid, groundShadow(COVER_AT.x, COVER_AT.y + 2.5, COVER_WIDTH * 2, 211, 0.3), SHADOW);
  return grid;
}

function heapOf(lights: readonly Light[]): Grid {
  const grid = shade(CELLS, HEAP_REGIONS, lights);
  outline(grid, INK);
  castShadow(grid, groundShadow(HEAP_AT.x, HEAP_AT.y + 2, HEAP_WIDTH * 2, 223, 0.3), SHADOW);
  return grid;
}

const WISPS: readonly (readonly (readonly [number, number, boolean])[])[] = [
  [[8, 17, true], [9, 14, false], [8, 11, false]],
  [[9, 16, true], [8, 13, false], [10, 10, false]],
  [[8, 18, true], [10, 15, false], [9, 12, false]],
];

const bigPuff: Stamp = [
  [0, 0, STONE[6]!], [1, 0, PAPER[2]!],
  [0, 1, PAPER[1]!], [1, 1, STONE[6]!],
];

const smallPuff: Stamp = [[0, 0, PAPER[1]!], [1, 0, STONE[6]!]];

function smokeOf(frame: number): Grid {
  const grid = createGrid(CELLS);
  for (const [x, y, big] of WISPS[frame % WISPS.length] ?? []) {
    stamp(grid, x, y, big ? bigPuff : smallPuff);
  }
  return grid;
}

const FRAMES = WISPS.length;

const PIT_CLIPS: readonly Clip[] = [
  { name: 'floor', frames: 1 },
  { name: 'heap', frames: 1 },
  { name: 'pots', frames: 1 },
  { name: 'cover', frames: 1 },
  { name: 'smoke', frames: FRAMES, fps: 2 },
];

const PIT_PIECES: readonly Piece[] = [
  { clip: 'floor', foot: 0 },
  { clip: 'heap', foot: Math.round(HEAP_AT.y + 2) },
  { clip: 'pots', foot: POT_FOOT },
  { clip: 'cover', foot: Math.round(COVER_AT.y + COVER_REACH) },
  { clip: 'smoke', foot: Math.round(COVER_AT.y + COVER_REACH) + 1 },
];

function draw(lights: readonly Light[], clip: string, frame: number): Grid {
  if (clip === 'heap') return heapOf(lights);
  if (clip === 'pots') return potsOf();
  if (clip === 'cover') return coverOf(lights);
  if (clip === 'smoke') return smokeOf(frame);
  return floorOf(lights);
}

export const pitFiring: Sprite = {
  name: 'pit-firing',
  cells: CELLS,
  lights: [SUN],
  clips: PIT_CLIPS,
  pieces: PIT_PIECES,
  draw,
};
