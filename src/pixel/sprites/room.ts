import { and, blob, ellipse, not, or } from '../field.ts';
import type { Mask } from '../field.ts';
import { layer, line, outline, put, stamp } from '../grid.ts';
import type { Grid, Stamp } from '../grid.ts';
import type { Rgba } from '../color.ts';
import type { Light } from '../light.ts';
import { BONE, CHAR, CLOTH, EARTH, EMBER, INK, SHADOW, STONE, WOOD } from '../palette.ts';
import { dome, flat, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Sprite } from '../sprite.ts';
import { FLOOR_ROWS, FLOOR_TOP, TILE_CELLS, TILT, castShadow, groundShadow } from '../view.ts';

/**
 * What stands on the floor of a works.
 *
 * These are the blocks of a design, drawn as the things they are: the patch of floor loads are
 * dropped on, the one they are collected from, barrels and sacks against the wall, a trough the
 * loads run along, a millstone. The interior used to be a grid of boxed symbols on a sheet of
 * felt — a diagram of a machine, which told the player that the inside of a building was a
 * different kind of thing from the outside.
 *
 * Every one of them is in the map's own view (`view.ts`): lit from the top-left, flat things
 * squashed to `TILT`, standing things keeping their height and showing their front.
 */

const CELLS = TILE_CELLS;

/** The one sun, the same one every other tile on the map is lit by. */
const SUN: readonly Light[] = [{ kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 }];

const box =
  (x0: number, y0: number, x1: number, y1: number): Mask =>
  (x, y) =>
    x >= x0 && x <= x1 && y >= y0 && y <= y1;

/**
 * The square of floor this tile stands on, inside the tile.
 *
 * A square of floor is drawn `cellW` across and `cellW * TILT` deep, and a tile is square — so
 * the cell's own footprint is only these rows of it, and the rest is headroom for whatever
 * stands up out of it. **Anything that has to meet the next square without a seam must span the
 * tile edge to edge and stay inside these rows**: a trough drawn over the full height of the
 * tile hangs a third of its length into the square behind it, which is what made a run of them
 * read as a row of separate planks.
 */
export const FLOOR_BOTTOM = FLOOR_TOP + FLOOR_ROWS - 1;
const FLOOR_MID = Math.round((FLOOR_TOP + FLOOR_BOTTOM) / 2);

/** Where a thing standing in the middle of its square has its feet. */
const FOOT = { x: 16, y: FLOOR_BOTTOM - 1 };

function stand(grid: Grid, width: number, seed: number, reach = 0.3): Grid {
  outline(grid, INK);
  castShadow(grid, groundShadow(FOOT.x, FOOT.y, width, seed, reach), SHADOW);
  return grid;
}

/* ------------------------------------------------------- the marked floor */

/**
 * A patch of floor somebody has marked out, chalked corner to corner.
 *
 * This replaced a doorway in a wall, which was the wrong drawing twice over: it could be laid in
 * the middle of the floor, where a door means nothing, and a way *in* and a way *out* came out as
 * the same picture. A marked bay is a thing that can honestly be anywhere, and the arrow chalked
 * on it is the one mark that says which way the goods are going.
 */
function bay(grid: Grid, chalk: Rgba): void {
  const corner = 7;
  for (let x = 1; x < 31; x += 1) {
    const end = x < 1 + corner || x > 30 - corner;
    if (!end) continue;
    put(grid, x, FLOOR_TOP + 1, chalk);
    put(grid, x, FLOOR_BOTTOM - 1, chalk);
  }
  for (let y = FLOOR_TOP + 1; y <= FLOOR_BOTTOM - 1; y += 1) {
    const end = y < FLOOR_TOP + 1 + corner * TILT || y > FLOOR_BOTTOM - 1 - corner * TILT;
    if (!end) continue;
    put(grid, 1, y, chalk);
    put(grid, 30, y, chalk);
  }
}

/** The arrow chalked in the bay: down into it for a drop, up out of it for a collection. */
function arrow(grid: Grid, into: boolean, chalk: Rgba): void {
  const tip = into ? FLOOR_BOTTOM - 5 : FLOOR_TOP + 4;
  const back = into ? tip - 5 : tip + 5;
  for (let i = 0; i <= 5; i += 1) {
    put(grid, 16 - i, tip - (into ? i : -i), chalk);
    put(grid, 16 + i, tip - (into ? i : -i), chalk);
  }
  for (let y = Math.min(tip, back); y <= Math.max(tip, back); y += 1) {
    put(grid, 16, y, chalk);
    put(grid, 15, y, chalk);
  }
}

/** A sack: tied at the neck, slumped at the foot. What arrives is in sacks. */
const sackOf = (cx: number, cy: number, high: number): Mask =>
  or(blob(cx, cy - high, 6, high * 0.85, 0.06, 13), blob(cx, cy, 7.5, 5, 0.05, 17));

function sack(grid: Grid, cx: number, cy: number, high: number): void {
  const shape = sackOf(cx, cy, high);
  const local = shade(
    CELLS,
    [{ mask: shape, material: { ramp: CLOTH, profile: dome, relief: 3.4, ambient: 0.42, contrast: 0.55, speckle: 0.18 } }],
    SUN,
  );
  for (const off of [-3, 2]) {
    for (let y = cy - high; y < cy + 2; y += 1) if (shape(cx + off, y)) put(local, cx + off, y, CLOTH[1]!);
  }
  for (let x = cx - 3; x <= cx + 3; x += 1) {
    if (shape(x, cy - high - 1)) put(local, x, cy - high - 1, EARTH[1]!);
    if (shape(x, cy - high)) put(local, x, cy - high, EARTH[2]!);
  }
  layer(grid, local, 0, 0);
}

/** A crate: slatted, square, stacked. What leaves is in crates. */
function crate(grid: Grid, cx: number, cy: number, w: number, h: number): void {
  const body = box(cx - w, cy - h, cx + w, cy);
  const top = and(ellipse(cx, cy - h, w, w * TILT), box(0, 0, 31, cy - h + 1));
  const local = shade(
    CELLS,
    [
      { mask: body, material: { ramp: WOOD, profile: flat, relief: 0, ambient: 0.44, contrast: 0.45, speckle: 0.28 } },
      { mask: top, material: { ramp: WOOD, profile: flat, relief: 0, ambient: 0.64, contrast: 0.3, speckle: 0.22 } },
    ],
    SUN,
  );
  for (let y = cy - h + 3; y < cy; y += 4) line(local, cx - w + 1, y, cx + w - 1, y, WOOD[0]!);
  for (const x of [cx - w, cx - w + 1, cx + w - 1, cx + w]) line(local, x, cy - h, x, cy, WOOD[1]!);
  layer(grid, local, 0, 0);
}

function bayScene(lights: readonly Light[], into: boolean, full: boolean): Grid {
  const grid = shade(CELLS, [], lights);

  if (full) {
    // What is waiting here. Sacks for what has been brought in, crates for what is going out —
    // two silhouettes, so a bay reads as one or the other before any label is looked at.
    if (into) {
      sack(grid, 11, FLOOR_BOTTOM - 3, 8);
      sack(grid, 21, FLOOR_BOTTOM - 5, 6);
    } else {
      crate(grid, 12, FLOOR_BOTTOM - 2, 7, 9);
      crate(grid, 22, FLOOR_BOTTOM - 4, 6, 8);
    }
  }

  outline(grid, INK);
  if (full) castShadow(grid, groundShadow(FOOT.x, FOOT.y, 24, into ? 811 : 813, 0.2), SHADOW);

  // The chalk goes on *after* the ink, the same rule a flame and a one-cell chip follow: a mark
  // a single cell wide, inked all round, comes out as a dark bracket and reads as iron rather
  // than as something drawn on the floor in chalk.
  // Pale chalk for what comes in, the town's own red ochre for what goes out: two marks that
  // are different before the arrow on them is read.
  const chalk = into ? BONE[5]! : EMBER[3]!;
  bay(grid, chalk);
  arrow(grid, into, chalk);
  return grid;
}

/* ---------------------------------------------------------------- the bins */

/** A barrel: a lid seen from above and in front, staves below it, two iron hoops. */
function barrel(grid: Grid, cx: number, cy: number, radius: number, high: number): void {
  const lid = blob(cx, cy - high, radius, radius * TILT, 0.04, 7);
  const body = and(
    or(blob(cx, cy, radius, radius * TILT, 0.04, 7), box(cx - radius, cy - high, cx + radius, cy)),
    not(lid),
  );

  const local = shade(
    CELLS,
    [
      { mask: body, material: { ramp: WOOD, profile: flat, relief: 0, ambient: 0.42, contrast: 0.5, speckle: 0.22 } },
      { mask: lid, material: { ramp: WOOD, profile: dome, relief: 1.6, ambient: 0.62, contrast: 0.4, speckle: 0.18 } },
    ],
    SUN,
  );

  for (let y = 0; y < CELLS; y += 1) {
    for (let x = 0; x < CELLS; x += 1) {
      if (!body(x, y)) continue;
      if (y === cy - high + 2 || y === cy - high + 3 || y === cy - 1 || y === cy) put(local, x, y, STONE[1]!);
      else if ((x - cx + 9) % 3 === 0) put(local, x, y, WOOD[0]!);
    }
  }
  for (let x = 0; x < CELLS; x += 1) {
    for (let y = 0; y < CELLS; y += 1) if (lid(x, y) && !lid(x, y + 1)) put(local, x, y, WOOD[1]!);
  }

  layer(grid, local, 0, 0);
}

/** A log, end on: rings on the cut face, bark round it. */
const log: Stamp = [
  [1, 0, WOOD[1]!], [2, 0, WOOD[2]!], [3, 0, WOOD[2]!], [4, 0, WOOD[1]!],
  [0, 1, WOOD[1]!], [1, 1, WOOD[4]!], [2, 1, WOOD[5]!], [3, 1, WOOD[4]!], [4, 1, WOOD[3]!], [5, 1, WOOD[1]!],
  [0, 2, WOOD[1]!], [1, 2, WOOD[3]!], [2, 2, WOOD[4]!], [3, 2, WOOD[2]!], [4, 2, WOOD[3]!], [5, 2, WOOD[0]!],
  [0, 3, WOOD[0]!], [1, 3, WOOD[2]!], [2, 3, WOOD[3]!], [3, 3, WOOD[2]!], [4, 3, WOOD[1]!], [5, 3, WOOD[0]!],
  [1, 4, WOOD[0]!], [2, 4, WOOD[1]!], [3, 4, WOOD[1]!], [4, 4, WOOD[0]!],
];

/** The deck a bin stands on before anything has been put in it: boards, and nothing on them. */
const DECK_TOP = box(4, FLOOR_MID - 3, 27, FLOOR_BOTTOM - 4);
const DECK_FACE = box(4, FLOOR_BOTTOM - 3, 27, FLOOR_BOTTOM - 1);

function binScene(lights: readonly Light[], holding: string): Grid {
  if (holding === 'empty') {
    const grid = shade(
      CELLS,
      [
        { mask: DECK_TOP, material: { ramp: WOOD, profile: flat, relief: 0, ambient: 0.5, contrast: 0.3, speckle: 0.3 } },
        { mask: DECK_FACE, material: { ramp: WOOD, profile: flat, relief: 0, ambient: 0.3, contrast: 0.25, speckle: 0.3 } },
      ],
      lights,
    );
    for (let x = 4; x <= 27; x += 5) line(grid, x, FLOOR_MID - 3, x, FLOOR_BOTTOM - 4, WOOD[1]!);
    return stand(grid, 24, 401, 0.12);
  }

  if (holding === 'wood') {
    const grid = shade(CELLS, [], lights);
    for (const [x, y] of [[3, 19], [9, 19], [15, 19], [21, 19], [6, 14], [12, 14], [18, 14], [9, 9], [15, 9]] as const) {
      stamp(grid, x, y, log);
    }
    return stand(grid, 28, 403, 0.18);
  }

  if (holding === 'water') {
    const grid = shade(CELLS, [], lights);
    barrel(grid, 9, FLOOR_BOTTOM - 1, 6, 12);
    barrel(grid, 22, FLOOR_BOTTOM - 3, 6, 12);
    return stand(grid, 28, 405, 0.22);
  }

  // Dirt and mud travel in sacks; mud's sag more and are darker at the foot, being full of wet.
  const wet = holding === 'mud';
  const grid = shade(CELLS, [], lights);
  sack(grid, 10, FLOOR_BOTTOM - 1, wet ? 8 : 10);
  sack(grid, 22, FLOOR_BOTTOM - 4, wet ? 7 : 9);
  const ramp = wet ? CHAR : EARTH;
  for (const [x, y] of [[15, 25], [16, 26], [17, 25], [14, 26], [18, 26], [16, 24]] as const) {
    put(grid, x, y, ramp[wet ? 2 : 3]!);
  }
  return stand(grid, 28, wet ? 409 : 407, 0.22);
}

/* -------------------------------------------------------------- the chute */

/**
 * A plank trough with a fall to it, which is how a load gets from one square to the next.
 *
 * **It has to meet the next one**, so it spans the tile edge to edge along the way it runs, keeps
 * inside the square's own footprint across it, and is never inked across the join — a run used to
 * come out as a row of separate planks, each with its own ends and its own shadow. The direction
 * is chalked on the bed instead of built into the shape, for the same reason: an asymmetric
 * trough cannot also be a seamless one.
 */
/** The trough and the channel cut in it, for a run that comes in one side and leaves by another. */
function runMasks(from: string, to: string): { trough: Mask; bed: Mask } {
  const upright = (side: string): boolean => side === 'n' || side === 's';
  const part = (side: string, bed: boolean): Mask => {
    const near = bed ? 2 : 5;
    const along =
      side === 'e'
        ? box(16 - near, FLOOR_TOP, 31, FLOOR_BOTTOM)
        : side === 'w'
          ? box(0, FLOOR_TOP, 16 + near, FLOOR_BOTTOM)
          : side === 'n'
            ? box(0, FLOOR_TOP, 31, FLOOR_MID + near)
            : box(0, FLOOR_MID - near, 31, FLOOR_BOTTOM);
    const across = upright(side)
      ? box(16 - near, 0, 16 + near, 31)
      : box(0, FLOOR_MID - near, 31, FLOOR_MID + near);
    return and(along, across);
  };
  return {
    trough: or(part(from, false), part(to, false)),
    bed: or(part(from, true), part(to, true)),
  };
}

/**
 * A plank trough with a fall to it, which is how a load gets from one square to the next.
 *
 * **It has to meet the next one**, so it spans the tile edge to edge along the way it runs, keeps
 * inside the square's own footprint across it, and is never inked across the join. The two halves
 * are built separately — the one the load comes in by and the one it leaves by — so a *corner* is
 * the same drawing as a straight with the two halves pointing different ways. A run that turns
 * used to be two straights butted end to side, which left the outside of every bend open.
 *
 * The direction is chalked on the bed rather than built into the shape, because an asymmetric
 * trough cannot also be a seamless one.
 */
function chuteScene(lights: readonly Light[], clip: string): Grid {
  const from = clip[0] ?? 'w';
  const to = clip[1] ?? 'e';
  const { trough, bed } = runMasks(from, to);

  const grid = shade(
    CELLS,
    [
      { mask: trough, material: { ramp: WOOD, profile: flat, relief: 0, ambient: 0.54, contrast: 0.38, speckle: 0.24 } },
      { mask: bed, material: { ramp: CHAR, profile: flat, relief: 0, ambient: 0.24, contrast: 0.22, speckle: 0.28 } },
    ],
    lights,
  );

  // The rails, found from the shape rather than drawn along it, so a bend is railed round its
  // outside the same way a straight is railed along its sides.
  for (let y = 0; y < CELLS; y += 1) {
    for (let x = 0; x < CELLS; x += 1) {
      if (!trough(x, y) || bed(x, y)) continue;
      if (!trough(x, y - 1) || bed(x, y - 1)) put(grid, x, y, WOOD[5]!);
      else if (!trough(x, y + 1) || bed(x, y + 1)) put(grid, x, y, WOOD[2]!);
      if (bed(x, y + 1) || bed(x + 1, y)) put(grid, x, y, INK);
    }
  }

  // Which way it runs: one chevron on the half it comes in by, one on the half it leaves by,
  // both pointing the way the load travels.
  const chalk = BONE[4]!;
  const chevron = (cx: number, cy: number, heading: string): void => {
    for (let i = 0; i <= 2; i += 1) {
      if (heading === 'e') { put(grid, cx + i, cy - 2 + i, chalk); put(grid, cx + i, cy + 2 - i, chalk); }
      if (heading === 'w') { put(grid, cx - i, cy - 2 + i, chalk); put(grid, cx - i, cy + 2 - i, chalk); }
      if (heading === 's') { put(grid, cx - 2 + i, cy + i, chalk); put(grid, cx + 2 - i, cy + i, chalk); }
      if (heading === 'n') { put(grid, cx - 2 + i, cy - i, chalk); put(grid, cx + 2 - i, cy - i, chalk); }
    }
  };
  const INWARD: Record<string, string> = { n: 's', s: 'n', e: 'w', w: 'e' };
  const at = (side: string, back: boolean): [number, number] => {
    const near = back ? 10 : 6;
    if (side === 'e') return [16 + near, FLOOR_MID];
    if (side === 'w') return [16 - near, FLOOR_MID];
    if (side === 'n') return [16, FLOOR_MID - Math.round(near * TILT)];
    return [16, FLOOR_MID + Math.round(near * TILT)];
  };
  const [ix, iy] = at(from, true);
  chevron(ix, iy, INWARD[from] ?? 'e');
  const [ox, oy] = at(to, false);
  chevron(ox, oy, to);

  // No `outline` and no shadow: both would draw a border round the tile, and a tile with a
  // border is a plank rather than a length of something longer.
  return grid;
}

/* ---------------------------------------------------------------- the mill */

const BED = ellipse(16, FLOOR_MID + 1, 13, 13 * TILT);
const BED_WALL = and(box(3, FLOOR_MID + 1, 29, FLOOR_BOTTOM - 1), or(ellipse(16, FLOOR_MID + 4, 13, 13 * TILT), box(3, FLOOR_MID + 1, 29, FLOOR_MID + 3)));
const RUNNER = ellipse(16, FLOOR_MID - 3, 9, 9 * TILT);
const EYE = ellipse(16, FLOOR_MID - 3, 2, 2 * TILT);

const MILL_REGIONS: readonly Region[] = [
  { mask: BED_WALL, material: { ramp: STONE, profile: flat, relief: 0, ambient: 0.26, contrast: 0.3, speckle: 0.3 } },
  { mask: BED, material: { ramp: STONE, profile: flat, relief: 0, ambient: 0.46, contrast: 0.4, speckle: 0.25 } },
  { mask: RUNNER, material: { ramp: STONE, profile: dome, relief: 2.8, ambient: 0.52, contrast: 0.55, speckle: 0.18 } },
  { mask: EYE, material: { ramp: CHAR, profile: flat, relief: 0, ambient: 0.1, contrast: 0.2 } },
];

function millScene(lights: readonly Light[], turn: number): Grid {
  const grid = shade(CELLS, MILL_REGIONS, lights);
  const mid = FLOOR_MID - 3;

  for (let spoke = 0; spoke < 6; spoke += 1) {
    const angle = (spoke / 6) * Math.PI * 2 + turn;
    line(grid, 16 + Math.cos(angle) * 3, mid + Math.sin(angle) * 3 * TILT, 16 + Math.cos(angle) * 8, mid + Math.sin(angle) * 8 * TILT, STONE[1]!);
  }

  const hx = Math.round(16 + Math.cos(turn) * 7);
  const hy = Math.round(mid + Math.sin(turn) * 7 * TILT);
  for (let y = hy - 9; y <= hy; y += 1) {
    put(grid, hx, y, WOOD[3]!);
    put(grid, hx + 1, y, WOOD[1]!);
  }
  line(grid, hx - 3, hy - 9, hx + 4, hy - 10, WOOD[5]!);
  line(grid, hx - 3, hy - 8, hx + 4, hy - 9, WOOD[2]!);

  for (const x of [6, 25]) {
    line(grid, x, FLOOR_BOTTOM - 3, x, FLOOR_BOTTOM, WOOD[1]!);
    put(grid, x + 1, FLOOR_BOTTOM, WOOD[0]!);
  }

  return stand(grid, 26, 701, 0.18);
}

/* ----------------------------------------------------------------- the tub */

/**
 * The mixing tub: a wooden vat with the mash in it and a paddle standing in the mash.
 *
 * A millstone grinds and a tub mixes, and mud is mixed — the first pass drew every combine block
 * as the same millstone, so the one recipe in the game was pictured by the one action it is not.
 * A combine is drawn for *what it does*, which means the drawing follows the recipe.
 */
const TUB_RIM = ellipse(16, FLOOR_MID - 4, 12, 12 * TILT);
const TUB_BODY = and(
  or(ellipse(16, FLOOR_MID + 3, 12, 12 * TILT), box(4, FLOOR_MID - 4, 28, FLOOR_MID + 3)),
  not(TUB_RIM),
);
const MASH = ellipse(16, FLOOR_MID - 3, 9, 9 * TILT);

function tubScene(lights: readonly Light[], stir: number): Grid {
  const grid = shade(
    CELLS,
    [
      { mask: TUB_BODY, material: { ramp: WOOD, profile: flat, relief: 0, ambient: 0.42, contrast: 0.5, speckle: 0.24 } },
      { mask: TUB_RIM, material: { ramp: CHAR, profile: flat, relief: 0, ambient: 0.3, contrast: 0.3, speckle: 0.2 } },
      { mask: MASH, material: { ramp: CHAR, profile: dome, relief: 1.2, ambient: 0.34, contrast: 0.45, density: 0.2, speckle: 0.3 } },
    ],
    lights,
  );

  // Staves and two iron hoops, as on a barrel: it is the same cooper's work.
  for (let y = 0; y < CELLS; y += 1) {
    for (let x = 0; x < CELLS; x += 1) {
      if (!TUB_BODY(x, y)) continue;
      if (y === FLOOR_MID || y === FLOOR_MID + 1) put(grid, x, y, STONE[1]!);
      else if ((x + 1) % 3 === 0) put(grid, x, y, WOOD[0]!);
    }
  }

  // The mash turning: a slick of wet dragged round by the paddle, and a lighter edge where it
  // climbs the side. Without the swirl a tub of mud is a dark disc and nothing says it is being
  // worked at all.
  for (let arm = 0; arm < 3; arm += 1) {
    const angle = stir + (arm / 3) * Math.PI * 2;
    for (let step = 3; step <= 8; step += 1) {
      const sweep = angle + step * 0.22;
      const x = Math.round(16 + Math.cos(sweep) * step);
      const y = Math.round(FLOOR_MID - 3 + Math.sin(sweep) * step * TILT);
      if (MASH(x, y)) put(grid, x, y, EARTH[arm === 0 ? 2 : 1]!);
    }
  }

  // The paddle, standing in the mash and leaning the way it is being pushed.
  const px = Math.round(16 + Math.cos(stir) * 5);
  const py = Math.round(FLOOR_MID - 3 + Math.sin(stir) * 5 * TILT);
  for (let y = py - 12; y <= py; y += 1) {
    put(grid, px + Math.round((py - y) * 0.15), y, WOOD[3]!);
    put(grid, px + 1 + Math.round((py - y) * 0.15), y, WOOD[1]!);
  }

  return stand(grid, 26, 751, 0.2);
}

/* -------------------------------------------------------------- the sprites */

export const BIN_FILLS = ['empty', 'water', 'dirt', 'mud', 'wood'] as const;

export const roomDrop: Sprite = {
  name: 'room-drop',
  cells: CELLS,
  lights: SUN,
  clips: [
    { name: 'empty', frames: 1 },
    { name: 'full', frames: 1 },
  ],
  draw: (lights, clip) => bayScene(lights, true, clip === 'full'),
};

export const roomPick: Sprite = {
  name: 'room-pick',
  cells: CELLS,
  lights: SUN,
  clips: [
    { name: 'empty', frames: 1 },
    { name: 'full', frames: 1 },
  ],
  draw: (lights, clip) => bayScene(lights, false, clip === 'full'),
};

export const roomBin: Sprite = {
  name: 'room-bin',
  cells: CELLS,
  lights: SUN,
  clips: BIN_FILLS.map((name) => ({ name, frames: 1 })),
  draw: (lights, clip) => binScene(lights, clip),
};

/** Every way a run can enter crossed with every way it can leave: four straights, eight bends. */
export const CHUTE_CLIPS: readonly string[] = ['n', 'e', 's', 'w'].flatMap((from) =>
  ['n', 'e', 's', 'w'].filter((to) => to !== from).map((to) => `${from}${to}`),
);

export const roomChute: Sprite = {
  name: 'room-chute',
  cells: CELLS,
  lights: SUN,
  clips: CHUTE_CLIPS.map((name) => ({ name, frames: 1 })),
  draw: (lights, clip) => chuteScene(lights, clip),
};

const MILL_FRAMES = 4;

export const roomMill: Sprite = {
  name: 'room-mill',
  cells: CELLS,
  lights: SUN,
  clips: [
    { name: 'idle', frames: 1 },
    { name: 'work', frames: MILL_FRAMES, fps: 4 },
  ],
  draw: (lights, clip, frame) =>
    millScene(lights, clip === 'work' ? ((frame % MILL_FRAMES) / MILL_FRAMES) * Math.PI * 2 : 0),
};

const TUB_FRAMES = 4;

export const roomTub: Sprite = {
  name: 'room-tub',
  cells: CELLS,
  lights: SUN,
  clips: [
    { name: 'idle', frames: 1 },
    { name: 'work', frames: TUB_FRAMES, fps: 4 },
  ],
  draw: (lights, clip, frame) =>
    tubScene(lights, clip === 'work' ? ((frame % TUB_FRAMES) / TUB_FRAMES) * Math.PI * 2 : 0.6),
};


/* --------------------------------------------------------------- the ring */

/**
 * A stone of the ring that bounds a works.
 *
 * The yard on the map is a floor of beaten earth ringed with the stones turned up clearing it,
 * and the room is that same yard from inside — so its boundary is the same stones, in the room's
 * own grid. Sixteen cells rather than thirty-two: a stone is about half a square across, and a
 * sprite drawn at half the width of its square has to have half the cells or the blit lands on
 * fractions of a pixel.
 */
const STONE_CELLS = 16;

function stoneScene(lights: readonly Light[], big: boolean): Grid {
  const w = big ? 7 : 5;
  const h = big ? 5.5 : 4;
  const body = blob(8, 11, w, h, 0.1, big ? 71 : 73);

  const grid = shade(
    STONE_CELLS,
    [{ mask: body, material: { ramp: STONE, profile: dome, relief: big ? 3.2 : 2.4, ambient: 0.4, contrast: 0.6, speckle: 0.3 } }],
    lights,
  );

  outline(grid, INK);
  castShadow(grid, groundShadow(8, 13, w * 2, big ? 77 : 79, 0.25), SHADOW);
  return grid;
}

export const roomStone: Sprite = {
  name: 'room-stone',
  cells: STONE_CELLS,
  lights: SUN,
  clips: [
    { name: 'big', frames: 1 },
    { name: 'small', frames: 1 },
  ],
  draw: (lights, clip) => stoneScene(lights, clip === 'big'),
};

export const ROOM_SPRITES: readonly Sprite[] = [roomDrop, roomPick, roomBin, roomChute, roomMill, roomTub, roomStone];
