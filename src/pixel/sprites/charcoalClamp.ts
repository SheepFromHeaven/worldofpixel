import { and, ellipse, blob } from '../field.ts';
import type { Mask } from '../field.ts';
import { createGrid, outline, put, stamp } from '../grid.ts';
import type { Grid, Stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { CHAR, EARTH, FIRE, INK, PAPER, SHADOW, STONE, WOOD } from '../palette.ts';
import { dome, flat, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Clip, Piece, Sprite } from '../sprite.ts';
import { TILE_CELLS, TILT, castShadow, groundShadow } from '../view.ts';

const CELLS = TILE_CELLS;

/**
 * A charcoal clamp: a cord of wood stacked into a cone, turfed and earthed over, with vents
 * round the foot of it and the chimney drawing at the top.
 *
 * The opposite drawing to the pit firing beside it. This one **stands up**, so it is inked, it
 * casts a shadow down and to the right away from the sun, and it is lit on the side nearest the
 * sun — every one of those is a cue the pit deliberately does without.
 *
 * **Truncated, not pointed.** Drawn to a tip it was a tent: two straight faces meeting at an
 * apex, with the courses of sod across them reading as thatch. A clamp is flat on top — that is
 * where the chimney is and where the collier feeds it — so the silhouette is a stump of a cone
 * with a crown you look down into, and the crown is the one part shaded as a surface turning
 * over while the sides stay upright faces.
 */
const CLAMP_AT = { x: 14, y: 24 };
const CLAMP_WIDTH = 10;
const CLAMP_HEIGHT = 12;
const APEX = CLAMP_AT.y - CLAMP_HEIGHT;
/** How wide the flat top is: the chimney and the standing room round it. */
const CROWN_HALF = 3;

/**
 * How wide the mound is at a row. Bellied rather than straight — the earth is thrown up the
 * outside of the stack and piles against its own foot — and never narrower than the crown.
 */
const halfWidth = (y: number): number => {
  const up = (CLAMP_AT.y - y) / CLAMP_HEIGHT;
  return Math.max(CROWN_HALF, CLAMP_WIDTH * (1 - up) ** 0.62);
};

/** How far the footprint reaches towards the viewer, foreshortened like anything lying flat. */
const REACH = CLAMP_WIDTH * TILT * 0.45;

const MOUND: Mask = (x, y) => {
  if (y < APEX) return false;
  const across = Math.abs(x - CLAMP_AT.x);
  if (y <= CLAMP_AT.y) return across <= halfWidth(y);
  const down = (y - CLAMP_AT.y) / REACH;
  return down <= 1 && across <= CLAMP_WIDTH * Math.sqrt(1 - down * down);
};

/** The flat top, and the chimney burnt through the middle of it. */
const CROWN = and(MOUND, ellipse(CLAMP_AT.x, APEX + 1.2, CROWN_HALF + 0.4, 2.6));
const EYE = and(CROWN, ellipse(CLAMP_AT.x, APEX + 1.2, 1.5, 1.1));

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

const MOUND_REGIONS: readonly Region[] = [
  // The sides: earth thrown up the outside and beaten down, lit from the top left. A real height
  // in cells, so the sun has a shape to find rather than a flat sticker to light.
  { mask: MOUND, material: { ramp: EARTH, profile: dome, relief: 5, ambient: 0.36, contrast: 0.72, speckle: 0.3 } },
  // The crown is the one part of it you look down on, so it is measured on its own and catches
  // more of the sky than the faces under it.
  { mask: CROWN, material: { ramp: EARTH, profile: dome, relief: 2, ambient: 0.55, contrast: 0.4, speckle: 0.24 } },
  { mask: EYE, material: { ramp: CHAR, profile: flat, relief: 0, ambient: 0.4, contrast: 0.3, speckle: 0.3 } },
];

/**
 * The apron the clamp is built on: ground trodden bare round it and the ash of the last burn in
 * the middle of that. It *lies on the ground*, so it takes no outline — the same reason the
 * works' floor and the dig's hole take none.
 */
const APRON_AT = { x: 14, y: 23 };
const APRON_RADIUS = 11.5;
const APRON = blob(APRON_AT.x, APRON_AT.y, APRON_RADIUS, APRON_RADIUS * TILT, 0.1, 71);
const ASH = blob(APRON_AT.x, APRON_AT.y + 1, 7.5, 7.5 * TILT, 0.14, 73);

const APRON_REGIONS: readonly Region[] = [
  { mask: APRON, material: { ramp: EARTH, profile: flat, relief: 0, ambient: 0.42, contrast: 0.3, speckle: 0.45 } },
  { mask: ASH, material: { ramp: CHAR, profile: flat, relief: 0, ambient: 0.6, contrast: 0.22, speckle: 0.42 } },
];

/**
 * The vents round the foot, which are what tell a charcoal clamp from a heap of spoil: dark
 * mouths with a lit sill under each, drawn after the ink so they stay holes rather than being
 * swallowed by the outline.
 */
const VENTS: readonly [number, number, boolean][] = [
  [6, 25, false], [10, 26, true], [14, 26, false], [18, 26, true], [21, 25, false],
];

const vent: Stamp = [
  [0, -1, CHAR[0]!], [1, -1, CHAR[0]!],
  [0, 0, CHAR[1]!], [1, 0, EARTH[3]!],
];

const lit: Stamp = [
  [0, -1, FIRE[2]!], [1, -1, CHAR[0]!],
  [0, 0, FIRE[1]!], [1, 0, EARTH[3]!],
];

/** Clods of the earth thrown up the outside, so the face is turned soil and not a smooth dome. */
const CLODS: readonly [number, number][] = [
  [9, 19], [17, 17], [12, 22], [19, 23], [7, 23], [15, 14], [11, 16], [20, 20], [16, 25],
];

const clod: Stamp = [[0, 0, EARTH[4]!], [1, 0, EARTH[2]!]];

/** Billets split and not yet stacked, lying at the near edge of the apron. */
const BILLETS: readonly [number, number][] = [[24, 28], [28, 28], [26, 25]];

const billet: Stamp = [
  [0, -2, INK], [1, -2, INK], [2, -2, INK],
  [-1, -1, INK], [0, -1, WOOD[3]!], [1, -1, WOOD[3]!], [2, -1, WOOD[2]!], [3, -1, INK],
  [-1, 0, INK], [0, 0, WOOD[2]!], [1, 0, WOOD[1]!], [2, 0, WOOD[1]!], [3, 0, INK],
  [0, 1, INK], [1, 1, INK], [2, 1, INK],
];

/** Chips and charred ends lying about the apron, in the one layer that lies on the ground. */
const CHIPS: readonly [number, number][] = [[4, 19], [23, 17], [7, 29], [19, 30], [2, 25], [25, 21]];

const chip: Stamp = [[0, 0, WOOD[3]!], [1, 0, WOOD[1]!]];
const cinder: Stamp = [[0, 0, CHAR[3]!], [1, 0, CHAR[1]!]];

function floorOf(lights: readonly Light[]): Grid {
  const grid = shade(CELLS, APRON_REGIONS, lights);
  for (const [index, [x, y]] of CHIPS.entries()) {
    if (MOUND(x, y)) continue;
    stamp(grid, x, y, index % 2 === 0 ? chip : cinder);
  }
  return grid;
}

function moundOf(lights: readonly Light[]): Grid {
  const grid = shade(CELLS, MOUND_REGIONS, lights);
  for (const [x, y] of CLODS) if (MOUND(x, y) && !CROWN(x, y)) stamp(grid, x, y, clod);

  outline(grid, INK);
  castShadow(grid, groundShadow(CLAMP_AT.x, CLAMP_AT.y + 3, CLAMP_WIDTH * 2, 307, 0.32), SHADOW);

  // After the ink: a vent two cells across would otherwise be nothing but outline.
  for (const [x, y, alight] of VENTS) stamp(grid, x, y, alight ? lit : vent);
  for (let x = 0; x < CELLS; x += 1) {
    for (let y = 0; y < CELLS; y += 1) if (EYE(x, y)) put(grid, x, y, CHAR[0]!);
  }
  stamp(grid, CLAMP_AT.x - 1, APEX + 1, [[0, 0, FIRE[2]!], [1, 1, FIRE[1]!]]);
  return grid;
}

function billetsOf(): Grid {
  const grid = createGrid(CELLS);
  for (const [x, y] of BILLETS) stamp(grid, x, y, billet);
  castShadow(grid, groundShadow(26.5, 29.5, 9, 311, 0.3), SHADOW);
  return grid;
}

/**
 * The smoke, as puffs rather than a shape, and taking no outline for the same reason the
 * hearth's flames take none — a mark two cells across comes out as nothing *but* outline.
 *
 * Thin and grey, never white. A clamp drawing properly gives a thread; a white column means it
 * has caught and the collier is running. Pale enough and it also stops reading as smoke at all
 * and starts reading as a gull over the town, which is what the first pass did.
 */
const WISPS: readonly (readonly (readonly [number, number, boolean])[])[] = [
  [[13, APEX - 2, true], [14, APEX - 5, false], [13, APEX - 8, false]],
  [[14, APEX - 3, true], [13, APEX - 6, false], [15, APEX - 9, false]],
  [[13, APEX - 1, true], [15, APEX - 4, false], [14, APEX - 7, false]],
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

const CLAMP_CLIPS: readonly Clip[] = [
  { name: 'floor', frames: 1 },
  { name: 'mound', frames: 1 },
  { name: 'billets', frames: 1 },
  { name: 'smoke', frames: FRAMES, fps: 2 },
];

/**
 * Four objects at four distances.
 *
 * **The apron takes its far edge**, which is the rule for anything lying on the ground: the
 * clamp standing on it is on top of it, and anything behind the apron's back edge is behind the
 * apron too. Given its near edge it would sort in front of the mound it carries and paint the
 * whole clamp out as a ring of bare earth.
 *
 * The mound's foot is where the earth meets the ground at the front of it; the billets lie a
 * little nearer still; the smoke rises out of the crown and so goes last, over the mound, which
 * is what reads as smoke from a clamp rather than smoke behind one.
 */
const CLAMP_PIECES: readonly Piece[] = [
  { clip: 'floor', foot: Math.round(APRON_AT.y - APRON_RADIUS * TILT) },
  { clip: 'mound', foot: Math.round(CLAMP_AT.y + REACH) },
  { clip: 'smoke', foot: Math.round(CLAMP_AT.y + REACH) + 1 },
  { clip: 'billets', foot: 30 },
];

function draw(lights: readonly Light[], clip: string, frame: number): Grid {
  if (clip === 'mound') return moundOf(lights);
  if (clip === 'billets') return billetsOf();
  if (clip === 'smoke') return smokeOf(frame);
  return floorOf(lights);
}

export const charcoalClamp: Sprite = {
  name: 'charcoal-clamp',
  cells: CELLS,
  lights: [SUN],
  clips: CLAMP_CLIPS,
  pieces: CLAMP_PIECES,
  draw,
};
