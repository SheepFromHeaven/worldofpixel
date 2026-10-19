import { and, blob, capsule, not, or, touching } from '../field.ts';
import { outline, stamp } from '../grid.ts';
import type { Grid, Stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { EARTH, FOLIAGE, INK, STONE, WOOD } from '../palette.ts';
import { cone, flat, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Sprite } from '../sprite.ts';

const CELLS = 32;

/**
 * The woodcutter: a clearing with one tree taken out of it, the stump left standing, the trunk
 * on the ground beside it and the cut rounds stacked where they will be collected.
 *
 * The third building that opens the ground, and the hardest of the three to say in one tile.
 * Water has a pool and earth has a hole — both are the ground itself, changed. Wood is not: the
 * forest is already drawn on the map in green, and a tile of trees sitting on it would say
 * nothing at all. So what is drawn is the *absence* — a bite taken out of the canopy, with the
 * stump at the middle of it as the one thing that could only be there because someone cut it.
 */

/** The clearing: bare, trodden ground where the canopy has been opened. */
const CLEARING = blob(16, 17, 10.2, 8.6, 0.1, 83);

/** What is left of the standing timber, round the edge of the bite. */
const CANOPY = and(blob(16, 16, 16.5, 16, 0.1, 11), not(CLEARING));

/**
 * The stump, cut flat. `flat` and not `dome`: a felled tree is sawn across, and a stump that
 * rounds over is a boulder with bark on it. The flat top is the whole of the reading.
 */
const STUMP = blob(11, 19, 3.6, 3, 0.07, 41);
const BARK = and(blob(11, 19, 4.8, 4, 0.07, 43), not(STUMP));

/** The trunk, down where it fell, and the rounds already cut off its end. */
const TRUNK = capsule(16, 22.5, 24, 20, 2.4);
const ROUNDS = or(
  blob(20.5, 12.5, 2.6, 2.2, 0.06, 59),
  or(blob(23.5, 14.5, 2.4, 2, 0.06, 61), blob(19.5, 16, 2.2, 1.9, 0.06, 67)),
);

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

const REGIONS: readonly Region[] = [
  // The standing wood is a ring of canopy round the outside, and it reads by being *higher*
  // than the clearing rather than by being a different green: the sun is what separates a tree
  // from the grass under it on a tile this size.
  { mask: CANOPY, material: { ramp: FOLIAGE, relief: 5, ambient: 0.1, contrast: 0.8, speckle: 0.4 } },
  // Sunlit grass, not bare earth. The clearing has to be the *palest* thing on the tile, or
  // the stump and the cut timber standing on it are brown on brown and the whole drawing reads
  // as one lumpy mound — which is exactly what it did while this was earth.
  { mask: CLEARING, material: { ramp: FOLIAGE, profile: flat, relief: 0.5, ambient: 0.86, contrast: 0.2, speckle: 0.3 } },
  // Chips and sawdust where the work is done, against the bare earth of the rest.
  { mask: touching(CLEARING, CANOPY), material: { ramp: FOLIAGE, relief: 1.6, ambient: 0.34, contrast: 0.6, speckle: 0.3 } },
  { mask: BARK, material: { ramp: EARTH, relief: 2.6, ambient: 0.0, contrast: 0.45, speckle: 0.2 } },
  { mask: STUMP, material: { ramp: WOOD, profile: flat, relief: 0.6, ambient: 0.92, contrast: 0.12, speckle: 0.1 } },
  { mask: TRUNK, material: { ramp: EARTH, relief: 3, ambient: 0.18, contrast: 0.8, speckle: 0.18 } },
  // Stacked, so each round is tipped rather than swollen — `cone` is what makes a pile of them
  // read as several things and not as one lumpy one.
  { mask: ROUNDS, material: { ramp: WOOD, profile: cone, relief: 2.4, ambient: 0.45, contrast: 0.7 } },
];

/**
 * The axe, left in the stump. Stamped rather than shaded, for the same reason the well's bucket
 * is: at six cells across there is no room for a gradient, and the whole of the shape is an ink
 * edge, a lit face of steel and a shaft.
 *
 * It is also the one upright thing on the tile. A clearing with a trunk lying in it is a place
 * a tree fell over; the axe is what says someone put it there.
 */
const axe: Stamp = [
  // The head, turned so its flat catches the light and its bit is in shadow against the haft.
  // Inked down one side only: a six-cell object outlined all round is a black mark with a
  // highlight in it, which is what this was before the ink came off its lit edge.
  [0, -8, STONE[6]!], [1, -8, STONE[5]!], [2, -8, INK],
  [-1, -7, STONE[6]!], [0, -7, STONE[6]!], [1, -7, STONE[4]!], [2, -7, STONE[2]!], [3, -7, INK],
  [-1, -6, STONE[4]!], [0, -6, STONE[4]!], [1, -6, STONE[2]!], [2, -6, INK], [3, -6, INK],
  [0, -5, STONE[2]!], [1, -5, INK],

  // The haft, with a lit side and a shaded one, running down into the grass.
  [0, -4, WOOD[3]!], [1, -4, INK],
  [0, -3, WOOD[3]!], [1, -3, INK],
  [0, -2, WOOD[2]!], [1, -2, INK],
  [0, -1, WOOD[2]!], [1, -1, INK],
  [0, 0, INK], [1, 0, INK],
];

/** Where it stands: in the flat of the stump, leaning out of the drawing's quietest corner. */
const AXE = { x: 14, y: 26 };

/** Chips thrown off the cut, lying where they fell. */
const CHIPS: [number, number][] = [
  [15, 24], [8, 23], [16, 15], [19, 23], [8, 15], [13, 13],
];

const chip: Stamp = [[0, 0, WOOD[3]!], [1, 0, WOOD[2]!]];

/** Saplings coming up in the light the clearing let in. */
const SHOOTS: [number, number][] = [[23, 25], [7, 11], [25, 8]];

const shoot: Stamp = [
  [0, 0, FOLIAGE[1]!], [0, -1, FOLIAGE[2]!], [0, -2, FOLIAGE[3]!], [-1, -1, FOLIAGE[1]!],
];

function draw(lights: readonly Light[]): Grid {
  const grid = shade(CELLS, REGIONS, lights);

  for (const [x, y] of CHIPS) if (CLEARING(x, y)) stamp(grid, x, y, chip);

  outline(grid, INK);

  // After the outline, like the well's bucket and tufts: both of these break the silhouette,
  // and a line traced round the tile would miss anything standing inside it.
  for (const [x, y] of SHOOTS) stamp(grid, x, y, shoot);
  stamp(grid, AXE.x, AXE.y, axe);

  return grid;
}

export const woodcutter: Sprite = {
  name: 'woodcutter',
  cells: CELLS,
  lights: [SUN],
  draw,
};
