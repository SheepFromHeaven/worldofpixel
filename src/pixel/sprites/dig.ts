import { and, blob, capsule, not, or } from '../field.ts';
import { outline, stamp } from '../grid.ts';
import type { Grid, Stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { EARTH, INK, STONE, WOOD } from '../palette.ts';
import { basin, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Sprite } from '../sprite.ts';

const CELLS = 32;

/**
 * The dig: a hole opened in the ground, the spoil thrown out beside it, and a spade left in the
 * heap.
 *
 * Earth is under every parcel, so unlike the well this building is not standing on anything the
 * map shows — the drawing has to say on its own that the ground here has been opened. A pit
 * alone reads as a shadow at this size; it is the pale heap of turned soil beside it, and the
 * one upright thing, that make it a place someone works.
 */
const PIT = blob(16, 19, 8.6, 6.8, 0.1, 53);

/**
 * The spoil, as a mound that excludes the hole it came out of — so it banks up along one side
 * the way a heap thrown from a pit does, rather than ringing it evenly.
 */
const HEAP = and(blob(13.5, 11.5, 11, 7.6, 0.13, 71), not(PIT));

/** The spade: a shaft stood in the heap, and the blade bitten into it. */
const SHAFT = capsule(25, 2.5, 21.5, 15.5, 1);
const BLADE = and(blob(21.1, 17.2, 2.4, 3, 0.06, 19), not(SHAFT));

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

const REGIONS: readonly Region[] = [
  // The hole. `density` is what makes it a hole rather than a brown patch: the deeper in, the
  // darker, whatever the sun is doing.
  { mask: PIT, material: { ramp: EARTH, profile: basin, relief: 4.5, ambient: 0.04, contrast: 0.42, density: 0.6, speckle: 0.22 } },
  // Turned soil catches the light where the flat ground beside it does not, which is most of
  // what separates the two at a glance.
  { mask: HEAP, material: { ramp: EARTH, relief: 4.2, ambient: 0.46, contrast: 0.9, speckle: 0.34 } },
  { mask: SHAFT, material: { ramp: WOOD, relief: 1.8, ambient: 0.4, contrast: 0.8 } },
  { mask: BLADE, material: { ramp: STONE, relief: 1.4, ambient: 0.3, contrast: 0.85 } },
];

/** Stones turned up out of the hole, and clods sitting on the heap. */
const STONES: [number, number][] = [[13, 20], [18, 22], [15, 24], [11, 18]];
const CLODS: [number, number][] = [[10, 9], [16, 8], [7, 13], [18, 11], [12, 6]];

const stone: Stamp = [
  [0, 0, STONE[5]!], [1, 0, STONE[3]!],
  [0, 1, STONE[2]!], [1, 1, INK],
];

const clod: Stamp = [[0, 0, EARTH[4]!], [1, 0, EARTH[3]!], [0, 1, EARTH[2]!]];

function draw(lights: readonly Light[]): Grid {
  const grid = shade(CELLS, REGIONS, lights);

  for (const [x, y] of STONES) if (PIT(x, y)) stamp(grid, x, y, stone);
  for (const [x, y] of CLODS) if (HEAP(x, y)) stamp(grid, x, y, clod);

  outline(grid, INK);
  return grid;
}

export const dig: Sprite = {
  name: 'dig',
  cells: CELLS,
  lights: [SUN],
  draw,
};
