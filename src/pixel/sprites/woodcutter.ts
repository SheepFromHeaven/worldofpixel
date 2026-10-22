import { and, blob, capsule, not, or } from '../field.ts';
import { at, createGrid, outline, stamp } from '../grid.ts';
import type { Grid, Stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { EARTH, FOLIAGE, INK, SHADOW, STONE, WOOD } from '../palette.ts';
import { flat, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Piece, Sprite } from '../sprite.ts';
import { TILT, castShadow, groundShadow } from '../view.ts';
import { AXE_HAFT, AXE_HEAD, grip, tool, workClips, worker, workerIn } from './work.ts';
import type { Build } from './villager.ts';
import type { Stance } from './work.ts';

const CELLS = 32;

const STUMP_AT = { x: 10, y: 17 };
const CUT = blob(STUMP_AT.x, STUMP_AT.y, 4.2, 4.2 * TILT, 0.06, 41);
const BARK = and(
  or(blob(STUMP_AT.x, STUMP_AT.y + 3.2, 4.6, 4.6 * TILT, 0.08, 43), (x, y) => Math.abs(x - STUMP_AT.x) <= 4.5 && y >= STUMP_AT.y && y <= STUMP_AT.y + 3.2),
  not(CUT),
);

const TRUNK = capsule(17.5, 24.5, 29, 23.5, 2.6);
const BUTT = blob(16.6, 24.5, 1.7, 2.5, 0.05, 47);

const ROUND_AT: readonly [number, number][] = [[20.5, 11.5], [25.5, 11.5], [23, 7.6]];
const ROUND_FACES = ROUND_AT.map(([x, y], i) => blob(x, y, 1.9, 2.1, 0.05, 59 + i));
const ROUND_BARK = ROUND_AT.map(([x, y], i) => and(blob(x, y, 2.6, 2.7, 0.05, 61 + i), not(ROUND_FACES[i]!)));

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

const END_GRAIN = { ramp: WOOD, profile: flat, relief: 0.6, ambient: 0.92, contrast: 0.12, speckle: 0.1 } as const;

const PILE_REGIONS: readonly Region[] = [
  ...ROUND_BARK.map((mask) => ({ mask, material: { ramp: EARTH, relief: 1.6, ambient: 0.02, contrast: 0.55 } })),
  ...ROUND_FACES.map((mask) => ({ mask, material: END_GRAIN })),
];

const STUMP_REGIONS: readonly Region[] = [
  { mask: BARK, material: { ramp: EARTH, relief: 2.6, ambient: 0.05, contrast: 0.55, speckle: 0.2 } },
  { mask: CUT, material: END_GRAIN },
];

const TRUNK_REGIONS: readonly Region[] = [
  { mask: TRUNK, material: { ramp: EARTH, relief: 3, ambient: 0.18, contrast: 0.8, speckle: 0.18 } },
  { mask: BUTT, material: END_GRAIN },
];

const REGIONS: readonly Region[] = [...PILE_REGIONS, ...STUMP_REGIONS, ...TRUNK_REGIONS];

const axe: Stamp = [
  [0, -8, STONE[6]!], [1, -8, STONE[5]!], [2, -8, INK],
  [-1, -7, STONE[6]!], [0, -7, STONE[6]!], [1, -7, STONE[4]!], [2, -7, STONE[2]!], [3, -7, INK],
  [-1, -6, STONE[4]!], [0, -6, STONE[4]!], [1, -6, STONE[2]!], [2, -6, INK], [3, -6, INK],
  [0, -5, STONE[2]!], [1, -5, INK],

  [0, -4, WOOD[3]!], [1, -4, INK],
  [0, -3, WOOD[3]!], [1, -3, INK],
  [0, -2, WOOD[2]!], [1, -2, INK],
  [0, -1, WOOD[2]!], [1, -1, INK],
  [0, 0, INK], [1, 0, INK],
];

const AXE = { x: 10, y: 17 };

const CHIPS: [number, number][] = [
  [15, 20], [4, 23], [13, 27], [19, 19], [6, 26], [16, 16],
];

const chip: Stamp = [[0, 0, WOOD[3]!], [1, 0, WOOD[2]!]];

const SHOOTS: [number, number][] = [[29, 29], [4, 12], [14, 9]];

const shoot: Stamp = [
  [0, 0, FOLIAGE[1]!], [0, -1, FOLIAGE[2]!], [0, -2, FOLIAGE[3]!], [-1, -1, FOLIAGE[1]!],
];

function rings(grid: Grid): void {
  const faces: [number, number][] = [[STUMP_AT.x, STUMP_AT.y], [16.6, 24.5], ...ROUND_AT];
  for (const [x, y] of faces) stamp(grid, Math.round(x), Math.round(y), [[0, 0, WOOD[1]!], [-1, 0, WOOD[2]!]]);
}

interface Chop {
  stance: Stance;
  angle: number;
  flying?: readonly [number, number][];
}

const FIGURE = { x: 11, y: 6 };

const CHOPS: readonly Chop[] = [
  { stance: { stoop: 0, hands: { left: [4, 1], right: [5, 1] } }, angle: -120 },
  { stance: { stoop: -1, hands: { left: [2, 6], right: [3, 7] } }, angle: -165 },
  {
    stance: { stoop: -1.5, hands: { left: [1, 9], right: [2, 10] } },
    angle: 150,
    flying: [[6, 12], [12, 11], [4, 15], [8, 10]],
  },
  { stance: { stoop: -0.5, hands: { left: [3, 9], right: [4, 10] } }, angle: 100 },
];

function ringAt(grid: Grid, x: number, y: number): void {
  stamp(grid, Math.round(x), Math.round(y), [[0, 0, WOOD[1]!], [-1, 0, WOOD[2]!]]);
}

function pileOf(lights: readonly Light[]): Grid {
  const grid = shade(CELLS, PILE_REGIONS, lights);
  for (const [x, y] of ROUND_AT) ringAt(grid, x, y);
  outline(grid, INK);
  castShadow(grid, groundShadow(23, 14, 9, 75, 0.4), SHADOW);
  return grid;
}

function stumpOf(lights: readonly Light[], axed: boolean): Grid {
  const grid = shade(CELLS, STUMP_REGIONS, lights);
  ringAt(grid, STUMP_AT.x, STUMP_AT.y);
  outline(grid, INK);
  castShadow(grid, groundShadow(STUMP_AT.x, STUMP_AT.y + 5.5, 9, 71, 0.35), SHADOW);

  if (axed) stamp(grid, AXE.x, AXE.y, axe);
  return grid;
}

function floorOf(): Grid {
  const grid = createGrid(CELLS);
  for (const [x, y] of CHIPS) stamp(grid, x, y, chip);
  for (const [x, y] of SHOOTS) stamp(grid, x, y, shoot);
  return grid;
}

function trunkOf(lights: readonly Light[]): Grid {
  const grid = shade(CELLS, TRUNK_REGIONS, lights);
  ringAt(grid, 16.6, 24.5);
  outline(grid, INK);
  castShadow(grid, blob(24, 27, 7, 1.6, 0.06, 73), SHADOW);
  return grid;
}

function scene(lights: readonly Light[], chop: Chop | null, build: Build): Grid {
  const grid = shade(CELLS, REGIONS, lights);
  rings(grid);

  outline(grid, INK);

  for (const [x, y] of CHIPS) if ((at(grid, x, y) & 0xff) === 0) stamp(grid, x, y, chip);
  castShadow(
    grid,
    or(
      groundShadow(STUMP_AT.x, STUMP_AT.y + 5.5, 9, 71, 0.35),
      or(blob(24, 27, 7, 1.6, 0.06, 73), groundShadow(23, 14, 9, 75, 0.4)),
    ),
    SHADOW,
  );

  for (const [x, y] of SHOOTS) stamp(grid, x, y, shoot);

  if (!chop) {
    stamp(grid, AXE.x, AXE.y, axe);
    return grid;
  }
  worker(grid, lights, FIGURE.x, FIGURE.y, chop.stance, build);
  tool(grid, grip(FIGURE.x, FIGURE.y, chop.stance), chop.angle, AXE_HEAD, AXE_HAFT);
  for (const [x, y] of chop.flying ?? []) stamp(grid, x, y, [[0, 0, WOOD[3]!]]);
  return grid;
}

function draw(lights: readonly Light[], clip: string, frame: number): Grid {
  if (clip === 'pile') return pileOf(lights);
  if (clip === 'stump') return stumpOf(lights, true);
  if (clip === 'trunk') return trunkOf(lights);
  if (clip === 'floor') return floorOf();

  const build = workerIn(clip);
  return scene(lights, build ? (CHOPS[frame % CHOPS.length] ?? null) : null, build ?? 'woman');
}

const WOODCUTTER_PIECES: readonly Piece[] = [
  { clip: 'floor', foot: 0 },
  { clip: 'pile', foot: 14 },
  { clip: 'stump', foot: 20 },
  { clip: 'trunk', foot: 27 },
];

export const woodcutter: Sprite = {
  name: 'woodcutter',
  cells: CELLS,
  lights: [SUN],
  clips: [
    ...workClips(CHOPS.length, 4),
    { name: 'floor', frames: 1 },
    { name: 'pile', frames: 1 },
    { name: 'stump', frames: 1 },
    { name: 'trunk', frames: 1 },
  ],
  pieces: WOODCUTTER_PIECES,
  draw,
};
