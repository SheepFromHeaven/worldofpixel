import { blob, or } from '../field.ts';
import type { Mask } from '../field.ts';
import { createGrid, put, stamp } from '../grid.ts';
import type { Grid, Stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { EARTH, INK, SHADOW, STONE } from '../palette.ts';
import { flat, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Clip, Piece, Sprite } from '../sprite.ts';
import { TILE_CELLS, TILT, castShadow, groundShadow } from '../view.ts';

/**
 * A works, seen from the map: a floor of beaten earth with a ring of stones round it.
 *
 * Not a timber shed. A town at this point is a fire and a few works — nobody has sawn a plank or
 * raised a frame, and a boarded building with a pitched roof says a century of carpentry the
 * settlement has not had. What people actually do first is clear a patch, tread it flat, and ring
 * it with the stones they turned up clearing it, so the ring is both the wall and where the
 * stones went.
 *
 * It is also honest about what the player is doing inside: the room is an open floor with things
 * standing on it, and this is that floor seen from above. The same works later deserves a roof
 * over it — that is a drawing for a town that has earned one.
 */

const CELLS = TILE_CELLS;

const SUN: readonly Light[] = [{ kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 }];

/** The floor: wider than it is deep, because it is lying down (`view.ts`). */
const CENTRE = { x: 16, y: 18 };
const RADIUS = 13.5;
const FLOOR = blob(CENTRE.x, CENTRE.y, RADIUS, RADIUS * TILT, 0.08, 61);
const TROD = blob(CENTRE.x, CENTRE.y + 1, RADIUS - 4, (RADIUS - 4) * TILT, 0.12, 67);

const REGIONS: readonly Region[] = [
  // Beaten earth, flat: a floor has no shape to light, and shading it into a dome would make
  // the works read as a mound of spoil.
  { mask: FLOOR, material: { ramp: EARTH, profile: flat, relief: 0, ambient: 0.42, contrast: 0.3, speckle: 0.45 } },
  // The middle, walked over until it is darker and smoother than the edges.
  { mask: TROD, material: { ramp: EARTH, profile: flat, relief: 0, ambient: 0.3, contrast: 0.2, speckle: 0.25 } },
];

/**
 * A stone of the ring: a lit crown, a shaded face, and ink only under it.
 *
 * Five cells across, not three. The first pass ringed the floor with three-cell pebbles and they
 * read as lumps in the earth rather than as a wall somebody built — at this size a stone has to
 * be big enough to break the floor's outline before it is a stone at all.
 */
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

/**
 * The floor and every stone are drawings of their own, and the split is not a drawing decision.
 *
 * The floor *lies on the ground* and each stone *stands on it* somewhere different — the ring
 * spans eighteen rows of the tile, so its near stones meet the ground half a parcel nearer the
 * viewer than its far ones. On a map sorted by foot that is the whole of what decides whether a
 * villager walking past is drawn over a stone or under it, and one picture can only carry one
 * foot: whichever it is given, it is wrong for every stone but one. Baked as one picture a
 * villager coming up the left side of the yard popped behind the whole ring at once.
 *
 * So the ring is a clip per stone, each with the row it sits on, and the painter puts all of them
 * in the depth sort beside the trees and the villagers.
 */
const RING: readonly { x: number; y: number; small: boolean }[] = (() => {
  const stones = 11;
  const placed: { x: number; y: number; small: boolean }[] = [];
  for (let i = 0; i < stones; i += 1) {
    const turn = (i / stones) * Math.PI * 2 - Math.PI / 2;
    // The gap at the front, towards the viewer: the way in. Without it the ring is a pen with
    // something kept inside rather than a floor somebody works on.
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

/**
 * A stone's foot is the row under it — the stamp puts its ink one row below the point it is
 * placed at, and that ink is where the stone meets the earth.
 *
 * **The floor's is its *far* edge, not its near one**, which is the rule for anything lying on the
 * ground rather than standing on it: everything that stands on a floor is on top of it, and
 * anything behind its back edge is behind it and does not overlap it at all. Given its near edge
 * — the row the earth actually stops at — the floor sorted in front of all nine stones and was
 * painted straight over them, and the works came out as a bare patch of dirt.
 */
const WORKS_PIECES: readonly Piece[] = [
  { clip: 'floor', foot: Math.round(CENTRE.y - RADIUS * TILT) },
  ...RING.map((stone, index) => ({ clip: `stone-${index}`, foot: stone.y + 1 })),
];

function floorOf(lights: readonly Light[]): Grid {
  const grid = shade(CELLS, REGIONS, lights);

  // Scuffs across the floor, in the direction people cross it.
  for (const [x, y] of [[10, 16], [18, 14], [13, 21], [21, 19], [16, 17]] as const) {
    put(grid, x, y, EARTH[1]!);
    put(grid, x + 1, y, EARTH[1]!);
  }

  // The ring's shadow, which falls on the ground and so belongs to the part that lies on it.
  castShadow(grid, groundShadow(CENTRE.x, CENTRE.y + RADIUS * TILT, RADIUS * 2, 911, 0.14), SHADOW);

  // **No outline.** The floor is ground, not a thing standing on it — the same reason the dig's
  // hole has none. Inked round, a patch of beaten earth comes out as a brown blob somebody has
  // drawn on the map, and the stones sitting on its edge read as bumps in it. The ring *is* the
  // edge, and it is the only thing here with an outline of its own.
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

/** Kept for the shape of the floor, which the room's own walls are drawn from. */
export const WORKS_FLOOR: Mask = or(FLOOR, TROD);
