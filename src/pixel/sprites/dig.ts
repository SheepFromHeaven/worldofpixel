import type { Mask } from '../field.ts';
import { and, blob, not } from '../field.ts';
import type { Grid, Stamp } from '../grid.ts';
import { at, createGrid, outline, put, stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { CHAR, EARTH, INK, SHADOW, STONE, WOOD } from '../palette.ts';
import type { Region } from '../shade.ts';
import { flat, shade } from '../shade.ts';
import type { Piece, Sprite } from '../sprite.ts';
import { TILT, castShadow, groundShadow } from '../view.ts';
import type { Build } from './villager.ts';
import type { Stance } from './work.ts';
import { BLADE, SPADE_HAFT, grip, tool, workClips, worker, workerIn } from './work.ts';

const CELLS = 32;

const CENTRE = { x: 12, y: 21 };
const OPENING = blob(CENTRE.x, CENTRE.y, 8.5, 8.5 * TILT, 0.1, 53);

const DEPTH = 4;

const FLOOR = and(OPENING, blob(CENTRE.x, CENTRE.y + DEPTH, 8.5, 8.5 * TILT, 0.1, 53));
const WALL = and(OPENING, not(FLOOR));

const HEAP_AT = { x: 23.5, y: 17 };
const HEAP_WIDTH = 7.5;
const HEAP_HEIGHT = 7;
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

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

const MOUND: readonly Region[] = [
  { mask: HEAP, material: { ramp: EARTH, relief: 5, ambient: 0.3, contrast: 0.95, speckle: 0.34 } },
];

const PIT: readonly Region[] = [
  { mask: WALL, material: { ramp: EARTH, profile: flat, relief: 0, ambient: 0.55, contrast: 0.2, speckle: 0.2 } },
  { mask: FLOOR, material: { ramp: CHAR, profile: flat, relief: 0, ambient: 0.55, contrast: 0.12, speckle: 0.3 } },
];

const RIM_SHADOW = and(OPENING, not(blob(CENTRE.x + 3, CENTRE.y + 2, 8.5, 8.5 * TILT, 0.1, 53)));

function strata(grid: Grid): void {
  for (let y = 0; y < CELLS; y += 1) {
    for (let x = 0; x < CELLS; x += 1) {
      if (WALL(x, y) && (y - Math.round(CENTRE.y)) % 2 === 0) put(grid, x, y, EARTH[1]!);
    }
  }
}

const LIP: Mask = (x, y) => !OPENING(x, y) && y > CENTRE.y && (OPENING(x, y - 1) || OPENING(x - 1, y - 1) || OPENING(x + 1, y - 1));

const STONES: [number, number][] = [[9, 25], [14, 26], [6, 23]];
const CLODS: [number, number][] = [[20, 15], [25, 13], [22, 18], [27, 17], [19, 19], [29, 21], [17, 21]];

const stone: Stamp = [
  [0, 0, STONE[4]!], [1, 0, STONE[2]!],
  [0, 1, STONE[1]!],
];

const clod: Stamp = [[0, 0, EARTH[4]!], [1, 0, EARTH[3]!], [0, 1, EARTH[2]!]];

const spade: Stamp = (() => {
  const cells: [number, number, number][] = [];
  for (let i = 0; i < 9; i += 1) {
    const x = Math.round(i * 0.3);
    cells.push([x, -4 - i, WOOD[3]!], [x + 1, -4 - i, INK]);
  }
  const top = { x: Math.round(8 * 0.3), y: -13 };
  cells.push(
    [top.x - 1, top.y - 1, WOOD[2]!], [top.x, top.y - 1, WOOD[3]!], [top.x + 1, top.y - 1, WOOD[2]!], [top.x + 2, top.y - 1, INK],
    [top.x - 1, top.y - 2, INK], [top.x, top.y - 2, INK], [top.x + 1, top.y - 2, INK],
  );
  cells.push(
    [-1, -3, STONE[6]!], [0, -3, STONE[5]!], [1, -3, STONE[3]!], [2, -3, INK],
    [-1, -2, STONE[5]!], [0, -2, STONE[4]!], [1, -2, STONE[2]!], [2, -2, INK],
    [-1, -1, EARTH[1]!], [0, -1, EARTH[1]!], [1, -1, EARTH[0]!],
  );
  return cells;
})();

const SPADE = { x: 23, y: 13 };

interface Spit {
  stance: Stance;
  angle: number;
  loaded?: boolean;
  thrown?: readonly [number, number];
}

const FIGURE = { x: 13, y: 12 };

const SPITS: readonly Spit[] = [
  { stance: { stoop: -0.5, hands: { left: [4, 8], right: [5, 9] } }, angle: 120 },
  { stance: { stoop: -1, hands: { left: [3, 9], right: [4, 10] } }, angle: 145, loaded: true },
  { stance: { stoop: 0, hands: { left: [5, 6], right: [6, 7] } }, angle: -150, loaded: true },
  { stance: { stoop: 0.5, hands: { left: [9, 4], right: [10, 5] } }, angle: -60, thrown: [24, 8] },
];

const CLOD: Stamp = [
  [0, -1, EARTH[4]!], [1, -1, EARTH[3]!],
  [0, 0, EARTH[2]!], [1, 0, EARTH[1]!],
];

function heapOf(lights: readonly Light[], spaded: boolean): Grid {
  const grid = shade(CELLS, MOUND, lights);
  for (const [x, y] of CLODS) if (HEAP(x, y)) stamp(grid, x, y, clod);
  outline(grid, INK);
  castShadow(grid, groundShadow(HEAP_AT.x, HEAP_AT.y + 2, HEAP_WIDTH * 2, 79, 0.3), SHADOW);
  if (spaded) stamp(grid, SPADE.x, SPADE.y, spade);
  return grid;
}

function floorOf(lights: readonly Light[]): Grid {
  const grid = createGrid(CELLS);
  for (const [x, y] of CLODS) if (!HEAP(x, y) && !OPENING(x, y)) stamp(grid, x, y, clod);

  const pit = shade(CELLS, PIT, lights);
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

function scene(lights: readonly Light[], spit: Spit | null, build: Build): Grid {
  const grid = shade(CELLS, MOUND, lights);
  for (const [x, y] of CLODS) if (HEAP(x, y)) stamp(grid, x, y, clod);
  outline(grid, INK);
  castShadow(grid, groundShadow(HEAP_AT.x, HEAP_AT.y + 2, HEAP_WIDTH * 2, 79, 0.3), SHADOW);
  for (const [x, y] of CLODS) if ((at(grid, x, y) & 0xff) === 0 && !OPENING(x, y)) stamp(grid, x, y, clod);

  const pit = shade(CELLS, PIT, lights);
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

  if (!spit) {
    stamp(grid, SPADE.x, SPADE.y, spade);
    return grid;
  }
  worker(grid, lights, FIGURE.x, FIGURE.y, spit.stance, build);
  const blade = tool(grid, grip(FIGURE.x, FIGURE.y, spit.stance), spit.angle, BLADE, SPADE_HAFT);
  if (spit.loaded) stamp(grid, blade[0], blade[1] - 1, CLOD);
  if (spit.thrown) stamp(grid, spit.thrown[0], spit.thrown[1], CLOD);
  return grid;
}

function draw(lights: readonly Light[], clip: string, frame: number): Grid {
  if (clip === 'floor') return floorOf(lights);
  if (clip === 'heap') return heapOf(lights, true);

  const build = workerIn(clip);
  return scene(lights, build ? (SPITS[frame % SPITS.length] ?? null) : null, build ?? 'woman');
}

const DIG_PIECES: readonly Piece[] = [
  { clip: 'floor', foot: 0 },
  { clip: 'heap', foot: 16 },
];

export const dig: Sprite = {
  name: 'dig',
  cells: CELLS,
  lights: [SUN],
  clips: [...workClips(SPITS.length, 3), { name: 'floor', frames: 1 }, { name: 'heap', frames: 1 }],
  pieces: DIG_PIECES,
  draw,
};
