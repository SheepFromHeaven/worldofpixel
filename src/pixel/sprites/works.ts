import { blob } from '../field.ts';
import type { Grid, Stamp } from '../grid.ts';
import { createGrid, put, stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { EARTH, INK, SHADOW, STONE } from '../palette.ts';
import type { Region } from '../shade.ts';
import { flat, shade } from '../shade.ts';
import type { Clip, Piece, Sprite } from '../sprite.ts';
import { TILE_CELLS, TILT, castShadow, groundShadow } from '../view.ts';

const CELLS = TILE_CELLS;

const SUN: readonly Light[] = [{ kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 }];

const CENTRE = { x: 16, y: 18 };
const RADIUS = 13.5;
const FLOOR = blob(CENTRE.x, CENTRE.y, RADIUS, RADIUS * TILT, 0.08, 61);
const TROD = blob(CENTRE.x, CENTRE.y + 1, RADIUS - 4, (RADIUS - 4) * TILT, 0.12, 67);

const REGIONS: readonly Region[] = [
  { mask: FLOOR, material: { ramp: EARTH, profile: flat, relief: 0, ambient: 0.42, contrast: 0.3, speckle: 0.45 } },
  { mask: TROD, material: { ramp: EARTH, profile: flat, relief: 0, ambient: 0.3, contrast: 0.2, speckle: 0.25 } },
];

const stone: Stamp = [
  [0, -3, STONE[5]!], [1, -3, STONE[6]!], [2, -3, STONE[4]!],
  [-1, -2, STONE[4]!], [0, -2, STONE[6]!], [1, -2, STONE[5]!], [2, -2, STONE[3]!], [3, -2, STONE[2]!],
  [-1, -1, STONE[3]!], [0, -1, STONE[4]!], [1, -1, STONE[3]!], [2, -1, STONE[2]!], [3, -1, STONE[1]!],
  [-1, 0, STONE[1]!], [0, 0, STONE[2]!], [1, 0, STONE[1]!], [2, 0, STONE[1]!], [3, 0, INK],
  [0, 1, INK], [1, 1, INK], [2, 1, INK],
];

const small: Stamp = [
  [0, -2, STONE[5]!], [1, -2, STONE[4]!],
  [-1, -1, STONE[3]!], [0, -1, STONE[5]!], [1, -1, STONE[3]!], [2, -1, STONE[1]!],
  [-1, 0, STONE[1]!], [0, 0, STONE[2]!], [1, 0, STONE[1]!], [2, 0, INK],
  [0, 1, INK], [1, 1, INK],
];

const RING: readonly { x: number; y: number; small: boolean }[] = (() => {
  const stones = 11;
  const placed: { x: number; y: number; small: boolean }[] = [];
  for (let i = 0; i < stones; i += 1) {
    const turn = (i / stones) * Math.PI * 2 - Math.PI / 2;
    if (Math.sin(turn) > 0.78) continue;
    const wobble = ((i * 37) % 5) * 0.2;
    placed.push({
      x: Math.round(CENTRE.x + Math.cos(turn) * (RADIUS - 1 + wobble)),
      y: Math.round(CENTRE.y + Math.sin(turn) * (RADIUS - 1 + wobble) * TILT),
      small: i % 3 === 1,
    });
  }
  return placed;
})();

const WORKS_CLIPS: readonly Clip[] = [
  { name: 'floor', frames: 1 },
  ...RING.map((_stone, index) => ({ name: `stone-${index}`, frames: 1 })),
];

const WORKS_PIECES: readonly Piece[] = [
  { clip: 'floor', foot: Math.round(CENTRE.y - RADIUS * TILT) },
  ...RING.map((stone, index) => ({ clip: `stone-${index}`, foot: stone.y + 1 })),
];

function floorOf(lights: readonly Light[]): Grid {
  const grid = shade(CELLS, REGIONS, lights);

  for (const [x, y] of [[10, 16], [18, 14], [13, 21], [21, 19], [16, 17]] as const) {
    put(grid, x, y, EARTH[1]!);
    put(grid, x + 1, y, EARTH[1]!);
  }

  castShadow(grid, groundShadow(CENTRE.x, CENTRE.y + RADIUS * TILT, RADIUS * 2, 911, 0.14), SHADOW);

  return grid;
}

function stoneOf(index: number): Grid {
  const grid = createGrid(CELLS);
  const placed = RING[index];
  if (placed) stamp(grid, placed.x - 1, placed.y, placed.small ? small : stone);
  return grid;
}

export const works: Sprite = {
  name: 'works',
  cells: CELLS,
  lights: SUN,
  clips: WORKS_CLIPS,
  pieces: WORKS_PIECES,
  draw: (lights, clip) => {
    const stoneAt = clip.startsWith('stone-') ? Number(clip.slice('stone-'.length)) : -1;
    return stoneAt >= 0 ? stoneOf(stoneAt) : floorOf(lights);
  },
};
