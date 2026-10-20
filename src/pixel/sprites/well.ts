import { and, blob, not } from '../field.ts';
import { line, outline, put, stamp } from '../grid.ts';
import type { Grid, Stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { EARTH, FOLIAGE, INK, SHADOW, STONE, WATER, WOOD } from '../palette.ts';
import { basin, flat, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Sprite } from '../sprite.ts';
import { TILT, castShadow, groundShadow } from '../view.ts';
import { grip, workClips, worker, workerIn } from './work.ts';
import type { Build } from './villager.ts';

const CELLS = 32;

/**
 * The well: the pool the water comes up in, and the bucket that says someone draws from it.
 *
 * This was the spring that used to be scattered over the map as a deposit. There are no deposits
 * any more — water is wherever the rivers and lakes are, and the map shows that in blue — so the
 * drawing moved to the one place it still means something: the building that draws the water.
 */

/**
 * The well in the map's three-quarter view (`view.ts`): a ring of stone seen from above and in
 * front, so its top is an ellipse and its near side is a wall you can see the courses of. The
 * water stands a little below the rim, which is what shows the inside of the far wall — and that
 * dark crescent is most of what makes it a shaft going down rather than a pond.
 *
 * It was drawn from straight overhead before, a round pool with a bank, which was fine until a
 * villager drawn from the front stood beside it and the two were plainly seen from different
 * places.
 */
/**
 * Left of the middle and short of the tile's width, so the villager who works it has somewhere
 * to stand at the rim — a well filling its tile edge to edge leaves the worker standing off it.
 */
const CENTRE = { x: 13, y: 13 };
const RADIUS = 10.5;
const RIM = blob(CENTRE.x, CENTRE.y, RADIUS, RADIUS * TILT, 0.06, 29);
const HOLE = blob(CENTRE.x, CENTRE.y, RADIUS - 3.5, (RADIUS - 3.5) * TILT, 0.06, 31);
const TOP = and(RIM, not(HOLE));

/** The near side of the ring, down to the ground: the rim's own outline, dropped four cells. */
const WALL = and(and(blob(CENTRE.x, CENTRE.y + 4.5, RADIUS, RADIUS * TILT, 0.06, 29), not(RIM)), (_x, y) => y > CENTRE.y);

/** The water, a cell and a half down the shaft, so the far wall shows above it. */
const POND = and(HOLE, blob(CENTRE.x, CENTRE.y + 1.6, RADIUS - 3.5, (RADIUS - 3.5) * TILT, 0.06, 31));
const SHAFT = and(HOLE, not(POND));

/** Where the well stands, for its shadow. */
const FOOT = { x: CENTRE.x, y: CENTRE.y + 4.5 + RADIUS * TILT - 1 };

/** Where the water comes up. Everything about the pool is lit from here. */
const EYE = { x: 12.5, y: 15 };

export const WELL_LIGHTS: readonly Light[] = [
  // Off the top-left corner and well above, which is where the hatching on the pencil map takes
  // its light from. One sun for every sprite or the tiles disagree with each other.
  { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 },

  // The water coming up. A pool lit only by the sun is a puddle; the water has to be brightest
  // where it is coming up, or nothing on the tile says this is a source of anything.
  { kind: 'glow', x: EYE.x, y: EYE.y, reach: 7, strength: 1.6, flatten: 1.4 },

  { kind: 'rings', x: EYE.x, y: EYE.y, spacing: 2.6, breaks: 2, rotation: -1, reach: 6.5, strength: 0.85, flatten: 1.4 },
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
  { mask: TOP, material: { ramp: STONE, relief: 2.2, ambient: 0.3, contrast: 0.7, speckle: 0.2 } },
  // The wall faces the viewer and away from the sun, so it sits low in the ramp and barely
  // leans: a face, not a mound.
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

/** Where it stands: on the ground beside the near wall, clear of the ring of light. */
const BUCKET = { x: 25, y: 28 };

/** A stone proud of the rim: a lit face, a shaded one, and a bite of shadow under it. */
const pebble: Stamp = [
  [0, 0, STONE[6]!], [1, 0, STONE[4]!],
  [0, 1, STONE[2]!], [1, 1, INK],
];

const tuft: Stamp = [
  [0, 0, FOLIAGE[1]!], [0, -1, FOLIAGE[2]!], [0, -2, FOLIAGE[3]!],
  [-1, -1, FOLIAGE[1]!], [1, -1, FOLIAGE[2]!], [1, -2, FOLIAGE[1]!],
];

/** Mortar between the stones of the wall: a course every three cells, joints staggered. */
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

/** The bucket small enough to go down the shaft: a rim, the water in it, and its hoop. */
const pail: Stamp = [
  [0, 0, INK], [1, 0, WATER[5]!], [2, 0, INK],
  [0, 1, INK], [1, 1, EARTH[3]!], [2, 1, INK],
  [1, 2, INK],
];

/**
 * Drawing water: the villager at the rim lets the pail down the shaft, it goes under, and it
 * comes back up full and is set down on the ground. Four frames, slow — a bucket on a rope is a
 * steady pull, not a flurry.
 *
 * The figure stands at the right of the rim and nearer than it, so it is laid over the well; the
 * rope runs from its hands back up the shaft to the pail, since further in is further up.
 */
interface Draw {
  stoop: number;
  /** Omitted, the arms hang at the figure's sides. */
  hands?: { left: readonly [number, number]; right: readonly [number, number] };
  /** Where the rope runs down to, in the tile, from the villager's hands; and the pail, if it shows. */
  rope?: readonly [number, number];
  pail?: readonly [number, number];
  splash?: boolean;
  /** The bucket set down on the ground, full, instead of on the rope. */
  landed?: boolean;
}

const FIGURE = { x: 16, y: 11 };

/**
 * Arms reaching forward at chest height, never up round the head: at sixteen cells a hand near
 * the face merges with it into one brown shape, and the figure stops being a person.
 */
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

  // After the outline: a tuft at the foot of the wall breaks the silhouette, which is what stops
  // the well reading as a cut-out laid on the ground. The bucket goes on after it for the same
  // reason, and carries its own dark edges.
  for (const [x, y] of TUFTS) stamp(grid, x, y, tuft);

  if (!working) {
    stamp(grid, BUCKET.x, BUCKET.y, bucket);
    return grid;
  }

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

function draw(lights: readonly Light[], clip: string, frame: number): Grid {
  const build = workerIn(clip);
  return scene(lights, build ? (DRAWS[frame % DRAWS.length] ?? null) : null, build ?? 'woman');
}

export const well: Sprite = {
  name: 'well',
  cells: CELLS,
  lights: WELL_LIGHTS,
  clips: workClips(DRAWS.length, 2),
  draw,
};
