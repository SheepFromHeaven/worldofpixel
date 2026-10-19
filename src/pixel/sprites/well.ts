import { and, blob, not, touching } from '../field.ts';
import { outline, stamp } from '../grid.ts';
import type { Grid, Stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { EARTH, FOLIAGE, INK, STONE, WATER } from '../palette.ts';
import { basin, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Sprite } from '../sprite.ts';

const CELLS = 32;

/**
 * The well: the pool the water comes up in, and the bucket that says someone draws from it.
 *
 * This was the spring that used to be scattered over the map as a deposit. There are no deposits
 * any more — water is wherever the rivers and lakes are, and the map shows that in blue — so the
 * drawing moved to the one place it still means something: the building that draws the water.
 */

/**
 * The pool and the water inside it. Both wander off the ellipse by about a sixth of their radius,
 * which is enough to look worn and not so much that the bank thins to nothing anywhere.
 */
const POOL = blob(14, 14.5, 11.5, 9.5, 0.08, 29);
const POND = blob(14, 14.5, 8.3, 6.6, 0.08, 31);
const BANK = and(POOL, not(POND));

/**
 * Where the water comes up. Everything about the pool is lit from here.
 *
 * The pool is drawn up and to the left of the middle of the tile, smaller than the square it
 * sits in, because the bucket needs somewhere to stand. Filling the tile edge to edge is what
 * the drawing wanted while it was a spring on the ground and nothing stood beside it.
 */
const EYE = { x: 13.5, y: 14 };

export const WELL_LIGHTS: readonly Light[] = [
  // Off the top-left corner and well above, which is where the hatching on the pencil map takes
  // its light from. One sun for every sprite or the tiles disagree with each other.
  { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 },

  // The water coming up. A pool lit only by the sun is a puddle; the water has to be brightest
  // where it is coming up, or nothing on the tile says this is a source of anything.
  { kind: 'glow', x: EYE.x, y: EYE.y, reach: 9, strength: 1.6, flatten: 1.16 },

  { kind: 'rings', x: EYE.x, y: EYE.y, spacing: 3, breaks: 2, rotation: -1, reach: 8.5, strength: 0.85, flatten: 1.16 },
];

/**
 * Declared once rather than built inside `draw`. Measuring a region is the slow part of shading
 * and the measurement is cached against the mask's identity, so a region rebuilt on every call
 * would be re-measured on every call — which the lab would feel as a stutter while dragging.
 *
 * Relief is a height in cells, so it halves along with everything else: the same bank drawn at
 * half the size stands half as many cells tall. Anything measured in cells — relief, a light's
 * reach, a ripple's spacing — has to move with the grid or the sprite is lit for a size it is
 * no longer drawn at.
 */
const REGIONS: readonly Region[] = [
  { mask: BANK, material: { ramp: STONE, relief: 3.2, ambient: 0.08, contrast: 0.8, speckle: 0.2 } },
  {
    mask: POND,
    material: { ramp: WATER, profile: basin, relief: 2.2, ambient: 0.16, contrast: 0.5, density: 0.22 },
  },
  // The wet ring where the water meets the stone. Last, so it takes the cells both regions
  // would otherwise argue over, and the bank never ends in a dry edge against the pool.
  { mask: touching(BANK, POND), material: { ramp: EARTH, relief: 1.4, ambient: 0.2, contrast: 0.7, speckle: 0.2 } },
];

const PEBBLES: [number, number][] = [
  [5, 10], [5, 17], [21, 9], [23, 15], [9, 21], [19, 20], [8, 9], [20, 8],
];

const TUFTS: [number, number][] = [
  [6, 9], [23, 12], [10, 23], [18, 22], [5, 19],
];

const GLINTS: [number, number][] = [
  [8, 12], [9, 12], [19, 16], [20, 16],
];

/**
 * The bucket, standing against the rim where the pool runs out of tile.
 *
 * Beside the pool rather than on it. The bank is three or four cells of stone at its widest, and
 * a bucket drawn on that is a smudge the same colour as what it is standing on — it has to break
 * the silhouette to be read at all, which is the same thing the tufts are for.
 *
 * Drawn cell by cell rather than shaded like the pool: at five cells across there is no room for
 * a gradient, so the whole of its shape is a lit stave, a shaded one, an iron hoop and the water
 * it is holding. The water is what makes it a well rather than a pail.
 */
const bucket: Stamp = [
  // The handle, with a row of daylight under it. Without the gap it is a tall dark rim rather
  // than a handle, which is the whole difference between a bucket and a pot.
  [1, -4, INK], [2, -4, INK], [3, -4, INK],
  [0, -3, INK], [4, -3, INK],

  // The mouth, with water in it — which is what makes it a well rather than a pail.
  [0, -2, INK], [1, -2, WATER[5]!], [2, -2, WATER[6]!], [3, -2, WATER[4]!], [4, -2, INK],

  // Staves, lit from the top left like everything else on the tile, with an iron hoop round.
  // Inked down both sides: a five-cell shape with an outline on one side only reads as half of
  // something, and at this size the outline *is* the drawing.
  [0, -1, INK], [1, -1, EARTH[4]!], [2, -1, EARTH[3]!], [3, -1, EARTH[2]!], [4, -1, INK],
  [0, 0, INK], [1, 0, STONE[5]!], [2, 0, STONE[4]!], [3, 0, STONE[2]!], [4, 0, INK],
  [0, 1, INK], [1, 1, EARTH[4]!], [2, 1, EARTH[3]!], [3, 1, EARTH[2]!], [4, 1, INK],

  // The base, which is also the shadow it stands in.
  [1, 2, INK], [2, 2, INK], [3, 2, INK],
]

/** Where it stands: against the near rim, clear of the water and of the ring of light. */
const BUCKET = { x: 25, y: 24 };

/** A stone proud of the rim: a lit face, a shaded one, and a bite of shadow under it. */
const pebble: Stamp = [
  [0, 0, STONE[6]!], [1, 0, STONE[4]!],
  [0, 1, STONE[2]!], [1, 1, INK],
];

const tuft: Stamp = [
  [0, 0, FOLIAGE[1]!], [0, -1, FOLIAGE[2]!], [0, -2, FOLIAGE[3]!],
  [-1, -1, FOLIAGE[1]!], [1, -1, FOLIAGE[2]!], [1, -2, FOLIAGE[1]!],
];

function draw(lights: readonly Light[]): Grid {
  const grid = shade(CELLS, REGIONS, lights);

  for (const [x, y] of PEBBLES) stamp(grid, x, y, pebble);
  for (const [x, y] of GLINTS) stamp(grid, x, y, [[0, 0, WATER[7]!]]);

  outline(grid, INK);

  // After the outline: a tuft on the rim breaks the silhouette, which is what stops the pool
  // reading as a coin lying on the ground. The bucket goes on after it for the same reason, and
  // carries its own dark edges — an outline traced round the whole tile would miss it, sitting
  // as it does in the middle of the stone.
  for (const [x, y] of TUFTS) stamp(grid, x, y, tuft);
  stamp(grid, BUCKET.x, BUCKET.y, bucket);

  return grid;
}

export const well: Sprite = { name: 'well', cells: CELLS, lights: WELL_LIGHTS, draw };
