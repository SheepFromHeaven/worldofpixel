import { and, blob, not } from '../field.ts';
import type { Grid, Stamp } from '../grid.ts';
import { createGrid, line, outline, put, stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { EARTH, FOLIAGE, INK, SHADOW, STONE, WATER, WOOD } from '../palette.ts';
import type { Region } from '../shade.ts';
import { basin, flat, shade } from '../shade.ts';
import type { Piece, Sprite } from '../sprite.ts';
import { TILT, castShadow, groundShadow } from '../view.ts';
import type { Build } from './villager.ts';
import { grip, workClips, worker, workerIn } from './work.ts';

const CELLS = 32;

const CENTRE = { x: 13, y: 13 };
const RADIUS = 10.5;
const RIM = blob(CENTRE.x, CENTRE.y, RADIUS, RADIUS * TILT, 0.06, 29);
const HOLE = blob(CENTRE.x, CENTRE.y, RADIUS - 3.5, (RADIUS - 3.5) * TILT, 0.06, 31);
const TOP = and(RIM, not(HOLE));

const WALL = and(and(blob(CENTRE.x, CENTRE.y + 4.5, RADIUS, RADIUS * TILT, 0.06, 29), not(RIM)), (_x, y) => y > CENTRE.y);

const POND = and(HOLE, blob(CENTRE.x, CENTRE.y + 1.6, RADIUS - 3.5, (RADIUS - 3.5) * TILT, 0.06, 31));
const SHAFT = and(HOLE, not(POND));

const FOOT = { x: CENTRE.x, y: CENTRE.y + 4.5 + RADIUS * TILT - 1 };

const EYE = { x: 12.5, y: 15 };

export const WELL_LIGHTS: readonly Light[] = [
  { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 },

  { kind: 'glow', x: EYE.x, y: EYE.y, reach: 7, strength: 1.6, flatten: 1.4 },

  { kind: 'rings', x: EYE.x, y: EYE.y, spacing: 2.6, breaks: 2, rotation: -1, reach: 6.5, strength: 0.85, flatten: 1.4 },
];

const REGIONS: readonly Region[] = [
  { mask: TOP, material: { ramp: STONE, relief: 2.2, ambient: 0.3, contrast: 0.7, speckle: 0.2 } },
  { mask: WALL, material: { ramp: STONE, profile: flat, relief: 0, ambient: 0.3, contrast: 0.25, speckle: 0.3 } },
  { mask: SHAFT, material: { ramp: STONE, profile: flat, relief: 0, ambient: 0.02, contrast: 0.15, speckle: 0.15 } },
  {
    mask: POND,
    material: { ramp: WATER, profile: basin, relief: 1.8, ambient: 0.16, contrast: 0.5, density: 0.22 },
  },
];

const PEBBLES: [number, number][] = [
  [4, 11], [20, 9], [21, 14], [7, 7], [17, 6], [3, 15],
];

const TUFTS: [number, number][] = [
  [2, 22], [27, 20], [6, 29], [22, 30], [1, 14],
];

const GLINTS: [number, number][] = [
  [9, 15], [10, 15], [15, 17], [16, 17],
];

const bucket: Stamp = [
  [1, -4, INK], [2, -4, INK], [3, -4, INK],
  [0, -3, INK], [4, -3, INK],

  [0, -2, INK], [1, -2, WATER[5]!], [2, -2, WATER[6]!], [3, -2, WATER[4]!], [4, -2, INK],

  [0, -1, INK], [1, -1, EARTH[4]!], [2, -1, EARTH[3]!], [3, -1, EARTH[2]!], [4, -1, INK],
  [0, 0, INK], [1, 0, STONE[5]!], [2, 0, STONE[4]!], [3, 0, STONE[2]!], [4, 0, INK],
  [0, 1, INK], [1, 1, EARTH[4]!], [2, 1, EARTH[3]!], [3, 1, EARTH[2]!], [4, 1, INK],

  [1, 2, INK], [2, 2, INK], [3, 2, INK],
]

const BUCKET = { x: 25, y: 28 };

const pebble: Stamp = [
  [0, 0, STONE[6]!], [1, 0, STONE[4]!],
  [0, 1, STONE[2]!], [1, 1, INK],
];

const tuft: Stamp = [
  [0, 0, FOLIAGE[1]!], [0, -1, FOLIAGE[2]!], [0, -2, FOLIAGE[3]!],
  [-1, -1, FOLIAGE[1]!], [1, -1, FOLIAGE[2]!], [1, -2, FOLIAGE[1]!],
];

function courses(grid: Grid): void {
  for (let y = 0; y < CELLS; y += 1) {
    for (let x = 0; x < CELLS; x += 1) {
      if (!WALL(x, y)) continue;
      const course = Math.floor((y - CENTRE.y) / 3);
      const joint = (y - CENTRE.y) % 3 === 0 || (x + course * 2) % 5 === 0;
      if (joint) put(grid, x, y, STONE[1]!);
    }
  }
}

const pail: Stamp = [
  [0, 0, INK], [1, 0, WATER[5]!], [2, 0, INK],
  [0, 1, INK], [1, 1, EARTH[3]!], [2, 1, INK],
  [1, 2, INK],
];

interface Draw {
  stoop: number;
  hands?: { left: readonly [number, number]; right: readonly [number, number] };
  rope?: readonly [number, number];
  pail?: readonly [number, number];
  splash?: boolean;
  landed?: boolean;
}

const FIGURE = { x: 16, y: 11 };

const DRAWS: readonly Draw[] = [
  { stoop: -1, hands: { left: [1, 9], right: [3, 10] }, rope: [14, 15], pail: [12, 13] },
  { stoop: -1.5, hands: { left: [1, 11], right: [3, 12] }, rope: [14, 16], splash: true },
  { stoop: -1, hands: { left: [2, 7], right: [3, 9] }, rope: [16, 12], pail: [14, 10] },
  { stoop: 0, landed: true },
];

function scene(lights: readonly Light[], working: Draw | null, build: Build): Grid {
  const grid = shade(CELLS, REGIONS, lights);
  courses(grid);

  for (const [x, y] of PEBBLES) if (TOP(x, y)) stamp(grid, x, y, pebble);
  for (const [x, y] of GLINTS) if (POND(x, y)) stamp(grid, x, y, [[0, 0, WATER[7]!]]);

  outline(grid, INK);
  castShadow(grid, groundShadow(FOOT.x, FOOT.y, RADIUS * 2, 37, 0.25), SHADOW);

  if (!working) return grid;

  if (working.splash) {
    stamp(grid, 13, 16, [[0, 0, WATER[7]!], [2, 0, WATER[6]!], [1, -1, WATER[7]!], [-1, 1, WATER[6]!], [3, 1, WATER[6]!]]);
  }
  if (working.pail) stamp(grid, working.pail[0], working.pail[1], pail);
  worker(grid, lights, FIGURE.x, FIGURE.y, working, build);
  if (working.rope) {
    const [hx, hy] = grip(FIGURE.x, FIGURE.y, working);
    line(grid, hx, hy, working.rope[0], working.rope[1], WOOD[1]!);
  }
  if (working.landed) stamp(grid, BUCKET.x - 7, BUCKET.y, bucket);
  return grid;
}

function floorOf(): Grid {
  const grid = createGrid(CELLS);
  for (const [x, y] of TUFTS) stamp(grid, x, y, tuft);
  return grid;
}

function bucketOf(): Grid {
  const grid = createGrid(CELLS);
  stamp(grid, BUCKET.x, BUCKET.y, bucket);
  return grid;
}

function draw(lights: readonly Light[], clip: string, frame: number): Grid {
  if (clip === 'floor') return floorOf();
  if (clip === 'bucket') return bucketOf();
  const build = workerIn(clip);
  return scene(lights, build ? (DRAWS[frame % DRAWS.length] ?? null) : null, build ?? 'woman');
}

const WELL_PIECES: readonly Piece[] = [
  { clip: 'floor', foot: 0 },
  { clip: 'default', foot: 17.99 },
  { clip: 'bucket', foot: BUCKET.y + 2 },
];

export const well: Sprite = {
  name: 'well',
  cells: CELLS,
  lights: WELL_LIGHTS,
  clips: [...workClips(DRAWS.length, 2), { name: 'floor', frames: 1 }, { name: 'bucket', frames: 1 }],
  pieces: WELL_PIECES,
  draw,
};
