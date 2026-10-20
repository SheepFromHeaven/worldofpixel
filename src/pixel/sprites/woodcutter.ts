import { and, blob, capsule, not, or } from '../field.ts';
import { at, outline, stamp } from '../grid.ts';
import type { Grid, Stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { EARTH, FOLIAGE, INK, SHADOW, STONE, WOOD } from '../palette.ts';
import { flat, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Sprite } from '../sprite.ts';
import { TILT, castShadow, groundShadow } from '../view.ts';
import { AXE_HAFT, AXE_HEAD, grip, tool, workClips, worker, workerIn } from './work.ts';
import type { Build } from './villager.ts';
import type { Stance } from './work.ts';

const CELLS = 32;

/**
 * The woodcutter: a stump with the axe left in it, the trunk it was felled from lying on the
 * ground, and the cut rounds stacked end-on where they will be collected.
 *
 * In the map's three-quarter view (`view.ts`), and with no trees in it. It used to be a ring of
 * canopy seen from overhead with a bite taken out of it — the absence of a tree, which was a good
 * idea from above and impossible from the side: a standing tree at the size of the people is
 * wider than this whole tile. The forest round it is drawn by the ground's own trees now, and a
 * woodcutter stands in a forest, so what the tile has to say is only that someone is cutting it.
 */

/** The stump: the cut face, an ellipse seen from above, and the bark round its near side. */
const STUMP_AT = { x: 10, y: 17 };
const CUT = blob(STUMP_AT.x, STUMP_AT.y, 4.2, 4.2 * TILT, 0.06, 41);
const BARK = and(
  or(blob(STUMP_AT.x, STUMP_AT.y + 3.2, 4.6, 4.6 * TILT, 0.08, 43), (x, y) => Math.abs(x - STUMP_AT.x) <= 4.5 && y >= STUMP_AT.y && y <= STUMP_AT.y + 3.2),
  not(CUT),
);

/** The trunk, down where it fell, with its sawn end towards the stump. */
const TRUNK = capsule(17.5, 24.5, 29, 23.5, 2.6);
const BUTT = blob(16.6, 24.5, 1.7, 2.5, 0.05, 47);

/**
 * The rounds already cut off it, stacked three to a pile with their ends to the viewer: a ring
 * of bark round a pale face each, which is what a woodpile looks like from the front.
 */
const ROUND_AT: readonly [number, number][] = [[20.5, 11.5], [25.5, 11.5], [23, 7.6]];
const ROUND_FACES = ROUND_AT.map(([x, y], i) => blob(x, y, 1.9, 2.1, 0.05, 59 + i));
const ROUND_BARK = ROUND_AT.map(([x, y], i) => and(blob(x, y, 2.6, 2.7, 0.05, 61 + i), not(ROUND_FACES[i]!)));

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

const END_GRAIN = { ramp: WOOD, profile: flat, relief: 0.6, ambient: 0.92, contrast: 0.12, speckle: 0.1 } as const;

const REGIONS: readonly Region[] = [
  ...ROUND_BARK.map((mask) => ({ mask, material: { ramp: EARTH, relief: 1.6, ambient: 0.02, contrast: 0.55 } })),
  ...ROUND_FACES.map((mask) => ({ mask, material: END_GRAIN })),
  { mask: BARK, material: { ramp: EARTH, relief: 2.6, ambient: 0.05, contrast: 0.55, speckle: 0.2 } },
  // Cut flat. `flat` and not `dome`: a felled tree is sawn across, and a stump whose top rounds
  // over is a boulder with bark on it. The flat top is the whole of the reading.
  { mask: CUT, material: END_GRAIN },
  { mask: TRUNK, material: { ramp: EARTH, relief: 3, ambient: 0.18, contrast: 0.8, speckle: 0.18 } },
  { mask: BUTT, material: END_GRAIN },
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

/** Where it stands: bitten into the cut face of the stump. */
const AXE = { x: 10, y: 17 };

/** Chips thrown off the cut, lying where they fell. */
const CHIPS: [number, number][] = [
  [15, 20], [4, 23], [13, 27], [19, 19], [6, 26], [16, 16],
];

const chip: Stamp = [[0, 0, WOOD[3]!], [1, 0, WOOD[2]!]];

/** Saplings coming up in the light the felling let in. */
const SHOOTS: [number, number][] = [[29, 29], [4, 12], [14, 9]];

const shoot: Stamp = [
  [0, 0, FOLIAGE[1]!], [0, -1, FOLIAGE[2]!], [0, -2, FOLIAGE[3]!], [-1, -1, FOLIAGE[1]!],
];

/** A ring or two on every cut face, so end grain reads as wood and not as a pale coin. */
function rings(grid: Grid): void {
  const faces: [number, number][] = [[STUMP_AT.x, STUMP_AT.y], [16.6, 24.5], ...ROUND_AT];
  for (const [x, y] of faces) stamp(grid, Math.round(x), Math.round(y), [[0, 0, WOOD[1]!], [-1, 0, WOOD[2]!]]);
}

/**
 * Splitting wood: the axe goes up over the head, comes down across the body, bites into the round
 * on the stump with the chips flying, and is brought back. The villager stands to the right of
 * the stump and in front of the woodpile, so the pile is behind it.
 */
interface Chop {
  stance: Stance;
  /** Which way the haft points from the hands, in degrees round from the right. */
  angle: number;
  /** Chips knocked off by the blow, in the tile. */
  flying?: readonly [number, number][];
}

const FIGURE = { x: 11, y: 6 };

const CHOPS: readonly Chop[] = [
  // Up over the shoulder, across the body, down into the stump, and resting while the arms come
  // back up. The blow lands the head on the cut face of the stump.
  { stance: { stoop: 0, hands: { left: [4, 1], right: [5, 1] } }, angle: -120 },
  { stance: { stoop: -1, hands: { left: [2, 6], right: [3, 7] } }, angle: -165 },
  {
    stance: { stoop: -1.5, hands: { left: [1, 9], right: [2, 10] } },
    angle: 150,
    flying: [[6, 12], [12, 11], [4, 15], [8, 10]],
  },
  { stance: { stoop: -0.5, hands: { left: [3, 9], right: [4, 10] } }, angle: 100 },
];

function scene(lights: readonly Light[], chop: Chop | null, build: Build): Grid {
  const grid = shade(CELLS, REGIONS, lights);
  rings(grid);

  outline(grid, INK);

  // After the ink: a chip is two cells, and an outline traced round two cells is all outline.
  for (const [x, y] of CHIPS) if ((at(grid, x, y) & 0xff) === 0) stamp(grid, x, y, chip);
  castShadow(
    grid,
    or(
      groundShadow(STUMP_AT.x, STUMP_AT.y + 5.5, 9, 71, 0.35),
      or(blob(24, 27, 7, 1.6, 0.06, 73), groundShadow(23, 14, 9, 75, 0.4)),
    ),
    SHADOW,
  );

  // After the outline, like the well's bucket and tufts: both of these break the silhouette,
  // and a line traced round the tile would miss anything standing inside it.
  for (const [x, y] of SHOOTS) stamp(grid, x, y, shoot);

  // Left in the stump when nobody is here; in someone's hands when they are.
  if (!chop) {
    stamp(grid, AXE.x, AXE.y, axe);
    return grid;
  }
  worker(grid, lights, FIGURE.x, FIGURE.y, chop.stance, build);
  tool(grid, grip(FIGURE.x, FIGURE.y, chop.stance), chop.angle, AXE_HEAD, AXE_HAFT);
  for (const [x, y] of chop.flying ?? []) stamp(grid, x, y, [[0, 0, WOOD[3]!]]);
  return grid;
}

function draw(lights: readonly Light[], clip: string, frame: number): Grid {
  const build = workerIn(clip);
  return scene(lights, build ? (CHOPS[frame % CHOPS.length] ?? null) : null, build ?? 'woman');
}

export const woodcutter: Sprite = {
  name: 'woodcutter',
  cells: CELLS,
  lights: [SUN],
    // A blow a second: brisk, where the well is a slow pull.
  clips: workClips(CHOPS.length, 4),
  draw,
};
