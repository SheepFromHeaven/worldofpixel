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

/**
 * A pit firing: a shallow pit scraped in the ground, pots stacked in it, and the near half of it
 * heaped over with turf and left to smoulder.
 *
 * It is the dig's problem again — the ground here has been *opened*, and the drawing has to say
 * so on its own, because earth is under every parcel and nothing on the map underneath it has
 * changed. So the pit follows `dig.ts` exactly: the far wall and the floor seen over the near
 * lip, **no outline and no shadow** on the hole, and the rim throwing shade in on the side
 * nearest the sun. Inked round, or lit on the sunward side, every one of those reads as a lump
 * standing *up*.
 *
 * The turf lifted to make the cover is heaped clear of the hole, off to one side like the dig's
 * spoil — banked along the far rim it has a straight top as wide as the pit and reads as a slab
 * laid over it.
 */
const CENTRE = { x: 15, y: 20 };
const RADIUS = 9;
const OPENING = blob(CENTRE.x, CENTRE.y, RADIUS, RADIUS * TILT, 0.1, 53);

/** Shallower than the dig: a hollow scraped out, not a shaft. */
const DEPTH = 4;

const FLOOR = and(OPENING, blob(CENTRE.x, CENTRE.y + DEPTH, RADIUS, RADIUS * TILT, 0.1, 53));
const WALL = and(OPENING, not(FLOOR));

/**
 * The shadow the rim throws in. The one cue that says *down* rather than *up*: a lump is lit on
 * the side nearest the sun, a hole is in shade there and catches what light reaches the far side.
 */
const RIM_SHADOW = and(OPENING, not(blob(CENTRE.x + 3, CENTRE.y + 2, RADIUS, RADIUS * TILT, 0.1, 53)));

/**
 * The cut edge along the front, a cell of bare earth. Ground stopping, so never inked.
 *
 * The front and nothing else. Run all the way round — which was tried, as a ring of upcast —
 * the pale rim closes the dark of the hole into a shape with an edge, and a shape with a lit
 * edge under it is a mound. What says *hole* is the dark going right up to the grass at the top
 * and only the near lip catching the light.
 */
const LIP: Mask = (x, y) =>
  !OPENING(x, y) && y > CENTRE.y && (OPENING(x, y - 1) || OPENING(x - 1, y - 1) || OPENING(x + 1, y - 1));

/**
 * The pots, standing on the floor of the pit. Drawn cell by cell rather than shaded, like the
 * well's bucket and for the same reason: at six cells there is no room for a gradient, so the
 * whole of the shape is a lit side, a shaded side, the dark of the mouth and the ink down both
 * edges — and at that size the ink *is* the drawing.
 *
 * Fired clay in `STONE_WARM`, high in the ramp. The wall they stand against is earth and the
 * floor under them is char, so a pot shaded like the hole it is in is a shape nobody can find;
 * tried as shaded ellipses they came out as two brown sacks.
 */
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

/** Where each stands in the pit, back to front: a crock set back, the big jar in front. */
const POTS: readonly { x: number; y: number; stamp: Stamp }[] = [
  { x: 12, y: 22, stamp: crock },
  { x: 18, y: 25, stamp: jar },
];

const POT_FOOT = Math.max(...POTS.map((pot) => pot.y)) + 1;

/**
 * The cover: turf sods heaped over the near half of the pit, scorched through and smouldering.
 *
 * Over the *near* half and not all of it. A pit covered edge to edge is a mound again — the pots
 * showing over the top of the sods are the whole of what says there is a hole under them.
 */
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

/**
 * The grass side of a sod: the top of the heap, and never its flanks. Taken as the top cells of
 * every column the band follows the silhouette down to the ground at either end, and the grass
 * comes out along the bottom of the pile where no grass could be.
 */
const SOD: Mask = (x, y) => COVER(x, y) && !COVER(x, y - 2) && y < COVER_AT.y;

/** Where the fire has come through the turf, round the crown. */
const SCORCH = and(COVER, ellipse(COVER_AT.x + 0.5, COVER_AT.y - COVER_RISE + 1.5, 1.8, 1.3));

const COVER_REGIONS: readonly Region[] = [
  { mask: COVER, material: { ramp: EARTH, profile: dome, relief: 4, ambient: 0.34, contrast: 0.78, speckle: 0.32 } },
  // The scorch before the sods and not after: burnt through at the crown is right, burnt over
  // the whole top takes the grass off and the cover stops being turf at all.
  { mask: SCORCH, material: { ramp: CHAR, profile: dome, relief: 2, ambient: 0.35, contrast: 0.45, speckle: 0.35 } },
  { mask: and(SOD, not(SCORCH)), material: { ramp: FOLIAGE, profile: flat, relief: 0, ambient: 0.42, contrast: 0.45, speckle: 0.4 } },
];

const EMBERS: [number, number][] = [[10, 22], [11, 22], [9, 21]];

/** Turf lifted and not used, heaped well clear of the hole. Grass still on the top of it. */
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

// Bare earth, like the dig's spoil. Capped with grass it reads as a bush standing beside the
// pit rather than as the ground that came out of it.
const HEAP_REGIONS: readonly Region[] = [
  { mask: HEAP, material: { ramp: EARTH, profile: dome, relief: 4, ambient: 0.32, contrast: 0.95, speckle: 0.34 } },
];

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

/** Stones turned up in the floor of the pit, and clods and sherds lying about the grass. */
const STONES: [number, number][] = [[15, 26], [22, 23]];
const CLODS: [number, number][] = [[29, 19], [3, 15], [5, 29], [22, 30]];
const SHERDS: [number, number][] = [[27, 27], [2, 22]];

const stone: Stamp = [
  [0, 0, STONE[4]!], [1, 0, STONE[2]!],
  [0, 1, STONE[1]!],
];

const clod: Stamp = [[0, 0, EARTH[4]!], [1, 0, EARTH[3]!], [0, 1, EARTH[2]!]];

/** A broken pot: a curve of fired clay lying on the grass, dark on its under side. */
const sherd: Stamp = [
  [0, 0, STONE_WARM[5]!], [1, 0, STONE_WARM[4]!], [2, 0, STONE_WARM[6]!],
  [0, 1, INK], [1, 1, STONE_WARM[2]!], [2, 1, INK],
];

/**
 * Layers in the far wall: a darker band every other row, so it is soil cut through rather than
 * one brown strip the same as the sods above it.
 */
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

/**
 * The hole, and the small stuff lying about it, in one layer at the back of the sort.
 *
 * The hole takes no outline and casts no shadow — its edge is the ground stopping, not a thing
 * standing on it — and a clod or a sherd is two or three cells lying on the grass, which is not
 * worth a piece of its own.
 */
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
  // Heaped earth stands up, so it is pinned to the ground like anything else that does.
  castShadow(grid, groundShadow(COVER_AT.x, COVER_AT.y + 2.5, COVER_WIDTH * 2, 211, 0.3), SHADOW);
  return grid;
}

function heapOf(lights: readonly Light[]): Grid {
  const grid = shade(CELLS, HEAP_REGIONS, lights);
  outline(grid, INK);
  castShadow(grid, groundShadow(HEAP_AT.x, HEAP_AT.y + 2, HEAP_WIDTH * 2, 223, 0.3), SHADOW);
  return grid;
}

/**
 * The smoke, as puffs rather than a shape, and taking no outline for the same reason the
 * hearth's flames take none — a mark two cells across comes out as nothing *but* outline.
 *
 * A thread and a grey one. Drawn pale it stops reading as smoke and starts reading as a gull
 * over the town, which is what the first pass did.
 */
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

/**
 * Five things standing at five distances, and the split is by object.
 *
 * The hole *lies in the ground* and takes the back of the sort along with the clods and sherds
 * on the grass; the spare turf is heaped half a parcel further up the map; the pots stand in the
 * pit; the cover is heaped over the near half of it, in front of them; the smoke rises out of
 * the cover. One picture could only carry one foot, and whichever it was given would be wrong
 * for four.
 */
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
