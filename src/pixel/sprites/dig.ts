import { and, blob, not } from '../field.ts';
import type { Mask } from '../field.ts';
import { at, createGrid, outline, put, stamp } from '../grid.ts';
import type { Grid, Stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { CHAR, EARTH, INK, SHADOW, STONE, WOOD } from '../palette.ts';
import { flat, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Piece, Sprite } from '../sprite.ts';
import { TILT, castShadow, groundShadow } from '../view.ts';
import { BLADE, SPADE_HAFT, grip, tool, workClips, worker, workerIn } from './work.ts';
import type { Build } from './villager.ts';
import type { Stance } from './work.ts';

const CELLS = 32;

/**
 * The dig: a hole opened in the ground, the spoil thrown up behind it, and a spade left in the
 * heap.
 *
 * Earth is under every parcel, so unlike the well this building is not standing on anything the
 * map shows — the drawing has to say on its own that the ground here has been opened.
 *
 * **A hole is drawn by what it does not have.** In the three-quarter view (`view.ts`) you look
 * into it over its near edge: you see the far wall, facing you and in shade, and the floor at
 * the bottom, darkest of all; the near wall is hidden behind the lip. And it has no outline and
 * no shadow, because its edge is the ground stopping, not a thing standing on it. Drawn as a
 * dark shape with an ink line round it and a shadow beside it — which is what it was — the eye
 * reads every one of those as a lump sticking *up*.
 */
const CENTRE = { x: 12, y: 21 };
const OPENING = blob(CENTRE.x, CENTRE.y, 8.5, 8.5 * TILT, 0.1, 53);

/** How far down the far wall shows before the floor starts, in cells. */
const DEPTH = 4;

/** The floor: the opening dropped by the depth, and only where the opening is. */
const FLOOR = and(OPENING, blob(CENTRE.x, CENTRE.y + DEPTH, 8.5, 8.5 * TILT, 0.1, 53));
const WALL = and(OPENING, not(FLOOR));

/**
 * The spoil: a heap of dug earth beside the hole, standing on the ground like anything else in
 * the three-quarter view — a hump rising from a flattened footprint, with its own shadow.
 *
 * Beside the hole and not wrapped round the back of it. Banked along the far rim, as it first
 * was, the heap had a straight top edge as wide as the pit and read as a slab or a roof laid
 * over it; a mound off to one side is a mound, and leaves the hole alone to be a hole.
 */
const HEAP_AT = { x: 23.5, y: 17 };
const HEAP_WIDTH = 7.5;
const HEAP_HEIGHT = 7;
const HEAP: Mask = and(
  (x, y) => {
    const across = (x - HEAP_AT.x) / HEAP_WIDTH;
    if (Math.abs(across) > 1) return false;
    // The footprint on the ground, and a rounded hump on top of it.
    const ground = HEAP_WIDTH * TILT * 0.5 * Math.sqrt(1 - across * across);
    const hump = HEAP_HEIGHT * (1 - across * across) ** 0.8;
    return y <= HEAP_AT.y + ground && y >= HEAP_AT.y - hump;
  },
  not(OPENING),
);

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

const MOUND: readonly Region[] = [
  // Turned soil catches the light where the flat ground beside it does not, which is most of
  // what separates the two at a glance.
  { mask: HEAP, material: { ramp: EARTH, relief: 5, ambient: 0.3, contrast: 0.95, speckle: 0.34 } },
];

const PIT: readonly Region[] = [
  // The far wall faces the viewer and has the sun behind it: low in the ramp, and flat, since it
  // is a face and not a slope.
  { mask: WALL, material: { ramp: EARTH, profile: flat, relief: 0, ambient: 0.55, contrast: 0.2, speckle: 0.2 } },
  // The floor in a darker ramp than the wall, not a darker step of the same one: in one ramp the
  // wall's darker layers and the floor are the same brown and the cut has no bottom.
  { mask: FLOOR, material: { ramp: CHAR, profile: flat, relief: 0, ambient: 0.55, contrast: 0.12, speckle: 0.3 } },
];

/**
 * The shadow the rim throws into the hole: the sun is up and to the left, so the inside just
 * under the upper-left edge is in shade and the far side catches what light gets in. It is the
 * one cue that says *down* rather than *up* — a lump is lit on the side nearest the sun, a hole
 * on the side furthest from it.
 */
const RIM_SHADOW = and(OPENING, not(blob(CENTRE.x + 3, CENTRE.y + 2, 8.5, 8.5 * TILT, 0.1, 53)));

/**
 * Layers in the far wall: a darker band every other row. Without them the wall is a brown strip
 * the same as the heap above it; with them it is soil cut through, which is what a dig shows.
 */
function strata(grid: Grid): void {
  for (let y = 0; y < CELLS; y += 1) {
    for (let x = 0; x < CELLS; x += 1) {
      if (WALL(x, y) && (y - Math.round(CENTRE.y)) % 2 === 0) put(grid, x, y, EARTH[1]!);
    }
  }
}

/**
 * The near lip: the cut edge of the ground along the front of the hole, a cell of bare earth
 * catching the light. It is ground, so it is not inked — the edge of a hole is where the grass
 * stops, not a line someone drew.
 */
const LIP: Mask = (x, y) => !OPENING(x, y) && y > CENTRE.y && (OPENING(x, y - 1) || OPENING(x - 1, y - 1) || OPENING(x + 1, y - 1));

/** Stones turned up in the floor, and clods on the heap and rolled off it onto the grass. */
const STONES: [number, number][] = [[9, 25], [14, 26], [6, 23]];
const CLODS: [number, number][] = [[20, 15], [25, 13], [22, 18], [27, 17], [19, 19], [29, 21], [17, 21]];

const stone: Stamp = [
  [0, 0, STONE[4]!], [1, 0, STONE[2]!],
  [0, 1, STONE[1]!],
];

const clod: Stamp = [[0, 0, EARTH[4]!], [1, 0, EARTH[3]!], [0, 1, EARTH[2]!]];

/**
 * The spade, stood in the heap: drawn cell by cell, like the woodcutter's axe. A shaft one cell
 * wide is nothing but outline once `outline` has been round it — a black stick — so it carries
 * its own dark edge on its shaded side instead.
 */
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
  // The blade, its top half out of the soil: a lit face of iron and its shaded edge.
  cells.push(
    [-1, -3, STONE[6]!], [0, -3, STONE[5]!], [1, -3, STONE[3]!], [2, -3, INK],
    [-1, -2, STONE[5]!], [0, -2, STONE[4]!], [1, -2, STONE[2]!], [2, -2, INK],
    [-1, -1, EARTH[1]!], [0, -1, EARTH[1]!], [1, -1, EARTH[0]!],
  );
  return cells;
})();

const SPADE = { x: 23, y: 13 };

/**
 * Digging: the spade driven in at the lip of the hole, levered, lifted with a clod on it, and the
 * clod thrown up onto the heap. The villager stands at the right of the hole and in front of the
 * heap, which is behind it.
 */
interface Spit {
  stance: Stance;
  /** Which way the haft points from the hands, in degrees round from the right. */
  angle: number;
  /** A clod riding on the blade. */
  loaded?: boolean;
  /** A clod in the air on its way to the heap, in the tile. */
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

/**
 * The heap, with the spade stood in it: the one thing here that stands *up*, so it is inked and
 * casts a shadow like anything else standing on the ground, and it sorts on its own foot.
 */
function heapOf(lights: readonly Light[], spaded: boolean): Grid {
  const grid = shade(CELLS, MOUND, lights);
  for (const [x, y] of CLODS) if (HEAP(x, y)) stamp(grid, x, y, clod);
  outline(grid, INK);
  castShadow(grid, groundShadow(HEAP_AT.x, HEAP_AT.y + 2, HEAP_WIDTH * 2, 79, 0.3), SHADOW);
  if (spaded) stamp(grid, SPADE.x, SPADE.y, spade);
  return grid;
}

/**
 * The floor: the hole itself and the clods that rolled off the heap onto the grass.
 *
 * The hole is the ground *stopping* rather than a thing standing on it — no outline and no
 * shadow — and a clod is two cells of earth lying about, so the two belong in one lying layer at
 * the back of the sort. The heap beside them is the only part of a dig that stands up.
 */
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
  // Clods that rolled off onto the grass, after the ink so they stay earth-coloured.
  for (const [x, y] of CLODS) if ((at(grid, x, y) & 0xff) === 0 && !OPENING(x, y)) stamp(grid, x, y, clod);

  // The hole after the ink, so nothing outlines it. Its far edge is the heap's own inked foot,
  // which is right: that is where the spoil stops and the cut begins.
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

  // Stood in the heap when nobody is here; in someone's hands when they are.
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

  // Somebody digging is the whole site in one drawing: the spade comes out of the heap and into
  // their hands, and a clod flies from the blade to the pile.
  const build = workerIn(clip);
  return scene(lights, build ? (SPITS[frame % SPITS.length] ?? null) : null, build ?? 'woman');
}

/** The hole and the clods lying about it, and the heap standing beside them. */
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
