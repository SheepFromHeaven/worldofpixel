import { blob } from '../field.ts';
import { at, createGrid, line, put } from '../grid.ts';
import type { Grid } from '../grid.ts';
import type { Light } from '../light.ts';
import { CLOTH, HAIR, INK, SHADOW, SKIN, STONE, WOOD } from '../palette.ts';
import type { Sprite } from '../sprite.ts';
import { castShadow } from '../view.ts';

const CELLS = 16;

/**
 * A tribesperson, drawn a pixel at a time from a skeleton.
 *
 * A four-cell head, a tunic four cells wide, and arms and legs one cell thick — the proportions
 * small pixel figures have always used, because at sixteen cells every cell has to be a part of
 * the body you could name. A frame is still a handful of numbers (where the feet are, where the
 * hands are), so the walk cycle cannot disagree with itself; what changed is how the numbers
 * become pixels.
 *
 * It used to be shaded capsules with an ink line traced round the silhouette, like the buildings.
 * At this size that does not hold: a capsule limb comes out three cells wide, an arm brought up
 * to the face merges with it into one brown lump, and an outline traced round a one-cell arm
 * turns the whole arm black. So limbs are lines of skin, light comes from colour choices — the
 * left of the tunic lit, the right in shade — and the ink goes *outside* the silhouette.
 */

/** The sun the lab shows the figure under. The figure is lit by its colours, not computed. */
const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

/** Who the figure is. Same skeleton, same poses; the head and the hem say which. */
export type Build = 'woman' | 'man';

export interface Pose {
  /** How far through the stride, as a signed swing. */
  swing: number;
  /** A body rises once per step, not once per cycle. */
  bob: number;
  /** Arms up beside the head, holding whatever is being carried. */
  holding?: boolean;
  /** Shifts the upper body alone, for a breath while standing. */
  breath?: number;
  /**
   * Where the two hands are, in the figure's own cells — for the work the buildings draw it
   * doing, which no clip of its own has a pose for: an axe overhead, a spade driven in.
   */
  hands?: { left: readonly [number, number]; right: readonly [number, number] };
  /**
   * How far the upper body bends towards the work, in cells: head and shoulders move this far
   * sideways and half as far down. Negative bends to the left.
   */
  stoop?: number;
  /** Omitted, the woman. */
  build?: Build;
  /** Which way the figure is walking; omitted, it faces the viewer. */
  heading?: Heading;
}

/**
 * The eight ways a villager can walk, as the compass reads on the map: `s` is towards the viewer,
 * `n` away. Every one is drawn, not mirrored — a mirrored figure takes its light from the right,
 * and everything else on the map is lit from the left.
 */
export const HEADINGS = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'] as const;
export type Heading = (typeof HEADINGS)[number];

/** Which way along x the figure is turned: +1 towards the right, -1 the left, 0 square on. */
const TURN: Record<Heading, number> = { s: 0, n: 0, e: 1, se: 1, ne: 1, w: -1, sw: -1, nw: -1 };
const SIDE = (heading: Heading): boolean => heading === 'e' || heading === 'w';
const SQUARE = (heading: Heading): boolean => heading === 's' || heading === 'n';

/** Feet on this row, and the shadow on the one below. */
const GROUND = 14;

/**
 * How long an arm is, shoulder to hand: the length it has hanging at the figure's side. A posed
 * hand further away is pulled back in along the same line, or an arm reaching across to the well
 * stretches to wherever the hand was put.
 */
const ARM = 3.6;

/**
 * How the body sits: how far the whole of it has risen (`bob`, a step), and how far the chest and
 * head have moved on top of that (`dx`, `dy`: a breath, a stoop). Kept apart because they are
 * rounded apart — rounded together, the top of the tunic and its hem came out a row adrift on
 * every step and the gap between them was inked as a belt.
 */
function upper(pose: Pose): { bob: number; dx: number; dy: number } {
  const lean = pose.stoop ?? 0;
  const bob = Math.round(pose.bob);
  return { bob, dx: Math.round(lean), dy: bob + Math.round((pose.breath ?? 0) + Math.abs(lean) * 0.5) };
}

const shoulderOf = (pose: Pose, side: 'left' | 'right'): [number, number] => {
  const { dx, dy } = upper(pose);
  return [(side === 'left' ? 5 : 10) + dx, 7 + dy];
};

/** Where a hand is, after the arm's length has had its say. */
export function handOf(pose: Pose, side: 'left' | 'right'): [number, number] {
  const shoulder = shoulderOf(pose, side);
  const { dy } = upper(pose);
  const reach = side === 'left' ? -pose.swing : pose.swing;
  const wanted =
    pose.hands?.[side] ??
    (pose.holding ? [side === 'left' ? 5 : 10, 3 + dy] : [shoulder[0], 10 + dy + Math.round(reach)]);
  const dxw = wanted[0] - shoulder[0];
  const dyw = wanted[1] - shoulder[1];
  const length = Math.hypot(dxw, dyw);
  if (length <= ARM) return [wanted[0], wanted[1]];
  return [shoulder[0] + (dxw / length) * ARM, shoulder[1] + (dyw / length) * ARM];
}

/**
 * The head from every side, as rows of cells — at four cells across, where the hair stops and the
 * face starts is the whole of which way someone is looking, so each one is drawn by hand.
 *
 *   L H h   hair, lit to dark      F f s d   skin, lit to dark      .   nothing
 *
 * Square on, the head is four cells. In profile it is five, the fifth the nose, and the drawing
 * is anchored so that the back of the head stays over the shoulders. Her hair falls to the jaw
 * and, from behind, down her back; his is cropped, and the beard is hair on the chin row.
 */
const HEADS: Record<Build, Record<Heading, readonly string[]>> = {
  woman: {
    s: ['LHHH', 'HFfh', 'Hfsh', '.sd.'],
    se: ['LHHH', 'HfFs', 'Hffd', 'H.sd'],
    e: ['LHHH.', 'HHff.', 'HHffs', 'Hh.d.'],
    ne: ['LHHH', 'HHHf', 'HHHs', 'HHh.'],
    n: ['LHHH', 'HHHh', 'HHHh', 'HHHh'],
    nw: ['LHHH', 'fHHh', 'sHHh', '.HHh'],
    w: ['.LHHH', '.FfHh', 'FffHh', '.f.hh'],
    sw: ['LHHH', 'FfsH', 'Ffdh', 'fs.h'],
  },
  man: {
    s: ['LHHH', 'fFfs', 'ffsd', '.Hh.'],
    se: ['LHHH', 'HfFs', 'Hffd', '.fHh'],
    e: ['LHHH.', 'Hfff.', 'Hffss', '.dHh.'],
    ne: ['LHHH', 'HHHf', 'HHHs', '.ds.'],
    n: ['LHHH', 'HHHh', 'HHHh', '.sd.'],
    nw: ['LHHH', 'fHHh', 'sHHh', '.fs.'],
    w: ['.LHHH', '.fffh', 'Fffsh', '.Hhd.'],
    sw: ['LHHH', 'Ffsh', 'Ffdh', 'HhF.'],
  },
};

const HEAD_CELLS: Record<string, number | undefined> = {
  L: HAIR[3],
  H: HAIR[2],
  h: HAIR[1],
  F: SKIN[4],
  f: SKIN[3],
  s: SKIN[2],
  d: SKIN[1],
};

/**
 * The tunic, a column at a time, lit from the left: the sun is up and to the left of everything
 * on the map, so the left of a body is the near-lit side and the right the shaded one.
 */
const TUNIC = [CLOTH[4]!, CLOTH[3]!, CLOTH[2]!, CLOTH[1]!];

function body(pose: Pose): Grid {
  const grid = createGrid(CELLS);
  const { bob, dx, dy } = upper(pose);
  const heading = pose.heading ?? 's';
  const turn = TURN[heading];
  const stride = Math.round(pose.swing);
  const hips = GROUND - 3 + bob;
  const man = pose.build === 'man';

  // The tunic's columns: four across square on and three-quarter, three in profile — a body seen
  // from the side is narrower than one seen from the front.
  const left = SIDE(heading) ? (turn > 0 ? 6 : 7) : 6;
  const right = SIDE(heading) ? left + 2 : 9;
  const middle = Math.floor((left + right) / 2);

  // Legs first, so the hem of the tunic hangs over them; feet a cell darker. The lit leg and the
  // shaded one are two tones apart — side by side in one tone they read as a single thick leg.
  // Seen from the side they scissor; seen from the front or back the stepping foot lifts instead,
  // since a stride towards the viewer is a leg coming up, not apart; the diagonals do a little
  // of both.
  const legs: [number, number][] = SIDE(heading)
    ? [[left + 1 + 2 * stride, GROUND - 1], [left + 1 - 2 * stride, GROUND - 1]]
    : SQUARE(heading)
      ? [[7, GROUND - 1 - (stride > 0 ? 1 : 0)], [8, GROUND - 1 - (stride < 0 ? 1 : 0)]]
      : [[7 + stride, GROUND - 1 - (stride > 0 ? 1 : 0)], [8 - stride, GROUND - 1 - (stride < 0 ? 1 : 0)]];
  const roots = SIDE(heading) ? [left + 1, left + 1] : [7, 8];
  legs.forEach(([fx, fy], i) => {
    line(grid, roots[i]!, hips, fx, fy, i === 0 ? SKIN[3]! : SKIN[1]!);
    put(grid, fx, fy + 1, HAIR[1]!);
  });

  // The far arm, in profile, before the body it is behind.
  const swingArm = pose.hands === undefined;
  if (SIDE(heading) && swingArm && !pose.holding) {
    line(grid, middle, 7 + dy, middle - 2 * stride, 10 + dy, SKIN[1]!);
  }

  // The tunic: four rows from the shoulders to the hips, the top two leaning with the body. The
  // woman's hem flares a cell either side, a dress; the man's hangs straight, belted.
  for (let row = 0; row < 4; row += 1) {
    const y = 7 + row + (row < 2 ? dy : bob + Math.round((dy - bob) / 2));
    const shift = row < 2 ? dx : Math.round(dx / 2);
    const flare = row === 3 && !man;
    for (let x = flare ? left - 1 : left; x <= (flare ? right + 1 : right); x += 1) {
      const color = man && row === 2 ? CLOTH[0]! : TUNIC[Math.min(3, Math.max(0, x - left))]!;
      put(grid, x + shift, y, color);
    }
  }

  // Arms, after the tunic so a hand brought across the body shows in front of it: the lit arm a
  // shade lighter than the shaded one, and the hand the lightest cell of each. Square on and
  // three-quarter, an arm swings in depth — which from here is up and down; swung sideways on the
  // diagonals it flapped like a wing.
  if (SIDE(heading) && swingArm) {
    // One arm, the near one, on the body's middle line: swinging against the near leg as it
    // walks, or raised in front of the face with the load.
    const hand: [number, number] = pose.holding ? [middle + turn, 3 + dy] : [middle + 2 * stride, 10 + dy];
    line(grid, middle, 7 + dy, hand[0], hand[1], SKIN[3]!);
    put(grid, hand[0], hand[1], SKIN[4]!);
  } else {
    for (const side of ['left', 'right'] as const) {
      const [sx, sy] = shoulderOf(pose, side);
      const [hx, hy] = handOf(pose, side);
      line(grid, sx, sy, Math.round(hx), Math.round(hy), side === 'left' ? SKIN[3]! : SKIN[2]!);
      put(grid, Math.round(hx), Math.round(hy), SKIN[4]!);
    }
  }

  // The head last, over anything raised beside it. In profile it is a cell wider, the nose, and
  // set so the back of the head stays over the shoulders.
  const art = HEADS[man ? 'man' : 'woman'][heading];
  const hx = 6 + dx + (heading === 'w' ? -1 : 0);
  const hy = 3 + dy;
  art.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const color = HEAD_CELLS[row[x]!];
      if (color !== undefined) put(grid, hx + x, hy + y, color);
    }
  });

  return grid;
}

/**
 * Ink round the outside of the silhouette: every empty cell beside a drawn one. Outside, not on
 * the edge — an edge traced inside a one-cell limb is the whole limb.
 */
function ink(grid: Grid): void {
  const edge: [number, number][] = [];
  for (let y = 0; y < CELLS; y += 1) {
    for (let x = 0; x < CELLS; x += 1) {
      if ((at(grid, x, y) & 0xff) !== 0) continue;
      const beside = [at(grid, x - 1, y), at(grid, x + 1, y), at(grid, x, y - 1), at(grid, x, y + 1)];
      if (beside.some((cell) => (cell & 0xff) === 0xff && cell !== INK)) edge.push([x, y]);
    }
  }
  for (const [x, y] of edge) put(grid, x, y, INK);
}

/**
 * The clips, as tables of poses.
 *
 * Standing still is not frame nought of the walk — it is its own short loop, and carrying is the
 * walk with the arms somewhere else. Keeping them as separate tables means a change to the
 * stride cannot quietly alter how someone stands.
 */
const STRIDE: readonly Pose[] = [
  { swing: 0, bob: 0 },
  { swing: 1, bob: -1 },
  { swing: 0, bob: 0 },
  { swing: -1, bob: -1 },
];

/**
 * Walking and carrying in every heading, and standing still facing the viewer — the ninth case,
 * no heading at all. A walk is a walk whichever way it goes, so every heading takes the same four
 * poses; only how they are drawn changes.
 */
const CLIPS: Record<string, readonly Pose[]> = {
  idle: [
    { swing: 0, bob: 0 },
    { swing: 0, bob: 0, breath: 1 },
  ],
  ...Object.fromEntries(
    HEADINGS.flatMap((heading) => [
      [`walk-${heading}`, STRIDE.map((pose) => ({ ...pose, heading }))],
      [`carry-${heading}`, STRIDE.map((pose) => ({ ...pose, heading, holding: true }))],
    ]),
  ),
};

function finish(grid: Grid): Grid {
  ink(grid);
  // The figure is drawn standing, from the front; the shadow at its feet is what puts it on the
  // same ground as everything else in the three-quarter view (`view.ts`).
  castShadow(grid, blob(9, GROUND + 1, 3.6, 1.1, 0.05, 7), SHADOW);
  return grid;
}

/**
 * Felling a tree, the trunk to the villager's left: the axe goes up, comes across, bites, and is
 * brought back. Four poses and the angle the haft points at in each, in degrees from the right.
 * `chop-e` is the same blow to the right — posed again, mirrored by hand, never by flipping the
 * tile, which would take the light from the wrong side.
 */
const CHOP: readonly { pose: Pose; angle: number }[] = [
  { pose: { swing: 0, bob: 0, hands: { left: [5, 4], right: [6, 4] } }, angle: -120 },
  { pose: { swing: 0, bob: 0, stoop: -0.5, hands: { left: [3, 7], right: [4, 8] } }, angle: -170 },
  { pose: { swing: 0, bob: 0, stoop: -1, hands: { left: [2, 10], right: [3, 10] } }, angle: 165 },
  { pose: { swing: 0, bob: 0, hands: { left: [4, 9], right: [5, 10] } }, angle: 110 },
];

/** Shorter than the woodcutter's: the villager's tile is sixteen cells, and the axe has to fit. */
const HATCHET = 3;

const mirrored = ({ pose, angle }: (typeof CHOP)[number]): (typeof CHOP)[number] => ({
  pose: {
    ...pose,
    stoop: -(pose.stoop ?? 0),
    ...(pose.hands
      ? { hands: { left: [15 - pose.hands.right[0], pose.hands.right[1]], right: [15 - pose.hands.left[0], pose.hands.left[1]] } }
      : {}),
  },
  angle: 180 - angle,
});

function chop(build: Build, toward: 'w' | 'e', frame: number): Grid {
  const blow = toward === 'w' ? CHOP[frame % CHOP.length]! : mirrored(CHOP[frame % CHOP.length]!);
  const pose = { ...blow.pose, build };
  const grid = finish(body(pose));
  const [hx, hy] = handOf(pose, toward === 'w' ? 'left' : 'right');
  const from = [Math.round(hx), Math.round(hy)] as const;
  const radians = (blow.angle * Math.PI) / 180;
  const to = [Math.round(from[0] + Math.cos(radians) * HATCHET), Math.round(from[1] + Math.sin(radians) * HATCHET)] as const;
  line(grid, from[0], from[1], to[0], to[1], WOOD[2]!);
  put(grid, to[0], to[1], STONE[5]!);
  put(grid, to[0] + (toward === 'w' ? -1 : 1), to[1], STONE[3]!);
  put(grid, to[0], to[1] + 1, INK);
  return grid;
}

function drawAs(build: Build) {
  return (_lights: readonly Light[], clip: string, frame: number): Grid => {
    if (clip === 'chop-w' || clip === 'chop-e') return chop(build, clip === 'chop-w' ? 'w' : 'e', frame);
    const poses = CLIPS[clip] ?? CLIPS.idle!;
    return finish(body({ ...(poses[frame % poses.length] ?? poses[0]!), build }));
  };
}

/**
 * The villager in a pose of the caller's, for the buildings that draw one at work inside them —
 * so a woodcutter swinging an axe is this same figure, and not a second person drawn to look
 * like it.
 */
export function drawFigure(_lights: readonly Light[], pose: Pose): Grid {
  return finish(body(pose));
}

const villager = (build: Build): Sprite => ({
  name: `villager-${build}`,
  cells: CELLS,
  clips: [
    // Slow, or a standing villager vibrates.
    { name: 'idle', frames: 2, fps: 2 },
    ...HEADINGS.flatMap((heading) => [
      { name: `walk-${heading}`, frames: STRIDE.length },
      { name: `carry-${heading}`, frames: STRIDE.length },
    ]),
    // A blow a second, like the woodcutter's.
    { name: 'chop-w', frames: CHOP.length, fps: 4 },
    { name: 'chop-e', frames: CHOP.length, fps: 4 },
  ],
  lights: [SUN],
  draw: drawAs(build),
});

export const villagerWoman = villager('woman');
export const villagerMan = villager('man');
