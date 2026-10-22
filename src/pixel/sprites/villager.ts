import { blob } from '../field.ts';
import { at, createGrid, line, put } from '../grid.ts';
import type { Grid } from '../grid.ts';
import type { Light } from '../light.ts';
import { CLOTH, EARTH, HAIR, INK, SHADOW, SKIN, STONE, WOOD } from '../palette.ts';
import type { Sprite } from '../sprite.ts';
import { castShadow } from '../view.ts';

const CELLS = 16;

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

export type Build = 'woman' | 'man';

export interface Pose {
  swing: number;
  bob: number;
  holding?: boolean;
  breath?: number;
  hands?: { left: readonly [number, number]; right: readonly [number, number] };
  stoop?: number;
  build?: Build;
  heading?: Heading;
}

export const HEADINGS = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'] as const;
export type Heading = (typeof HEADINGS)[number];

const TURN: Record<Heading, number> = { s: 0, n: 0, e: 1, se: 1, ne: 1, w: -1, sw: -1, nw: -1 };
const SIDE = (heading: Heading): boolean => heading === 'e' || heading === 'w';
const SQUARE = (heading: Heading): boolean => heading === 's' || heading === 'n';

const GROUND = 14;

const ARM = 3.6;

function upper(pose: Pose): { bob: number; dx: number; dy: number } {
  const lean = pose.stoop ?? 0;
  const bob = Math.round(pose.bob);
  return { bob, dx: Math.round(lean), dy: bob + Math.round((pose.breath ?? 0) + Math.abs(lean) * 0.5) };
}

const shoulderOf = (pose: Pose, side: 'left' | 'right'): [number, number] => {
  const { dx, dy } = upper(pose);
  return [(side === 'left' ? 5 : 10) + dx, 7 + dy];
};

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

const TUNIC = [CLOTH[4]!, CLOTH[3]!, CLOTH[2]!, CLOTH[1]!];

function body(pose: Pose): Grid {
  const grid = createGrid(CELLS);
  const { bob, dx, dy } = upper(pose);
  const heading = pose.heading ?? 's';
  const turn = TURN[heading];
  const stride = Math.round(pose.swing);
  const hips = GROUND - 3 + bob;
  const man = pose.build === 'man';

  const left = SIDE(heading) ? (turn > 0 ? 6 : 7) : 6;
  const right = SIDE(heading) ? left + 2 : 9;
  const middle = Math.floor((left + right) / 2);

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

  const swingArm = pose.hands === undefined;
  if (SIDE(heading) && swingArm && !pose.holding) {
    line(grid, middle, 7 + dy, middle - 2 * stride, 10 + dy, SKIN[1]!);
  }

  for (let row = 0; row < 4; row += 1) {
    const y = 7 + row + (row < 2 ? dy : bob + Math.round((dy - bob) / 2));
    const shift = row < 2 ? dx : Math.round(dx / 2);
    const flare = row === 3 && !man;
    for (let x = flare ? left - 1 : left; x <= (flare ? right + 1 : right); x += 1) {
      const color = man && row === 2 ? CLOTH[0]! : TUNIC[Math.min(3, Math.max(0, x - left))]!;
      put(grid, x + shift, y, color);
    }
  }

  if (SIDE(heading) && swingArm) {
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

const STRIDE: readonly Pose[] = [
  { swing: 0, bob: 0 },
  { swing: 1, bob: -1 },
  { swing: 0, bob: 0 },
  { swing: -1, bob: -1 },
];

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
  castShadow(grid, blob(9, GROUND + 1, 3.6, 1.1, 0.05, 7), SHADOW);
  return grid;
}

interface Blow {
  pose: Pose;
  angle: number;
  clod?: 'blade' | 'flying';
}

const CHOP: readonly Blow[] = [
  { pose: { swing: 0, bob: 0, hands: { left: [5, 4], right: [6, 4] } }, angle: -120 },
  { pose: { swing: 0, bob: 0, stoop: -0.5, hands: { left: [3, 7], right: [4, 8] } }, angle: -170 },
  { pose: { swing: 0, bob: 0, stoop: -1, hands: { left: [2, 10], right: [3, 10] } }, angle: 165 },
  { pose: { swing: 0, bob: 0, hands: { left: [4, 9], right: [5, 10] } }, angle: 110 },
];

const DIG: readonly Blow[] = [
  { pose: { swing: 0, bob: 0, hands: { left: [5, 8], right: [6, 7] } }, angle: 115 },
  { pose: { swing: 0, bob: 0, stoop: -1, hands: { left: [4, 10], right: [5, 9] } }, angle: 145, clod: 'blade' },
  { pose: { swing: 0, bob: 0, hands: { left: [5, 7], right: [6, 6] } }, angle: -165, clod: 'blade' },
  { pose: { swing: 0, bob: 0, hands: { left: [6, 5], right: [7, 5] } }, angle: -115, clod: 'flying' },
];

const HATCHET = 3;
const SHOVEL = 4;

const mirrored = (blow: Blow): Blow => ({
  ...blow,
  pose: {
    ...blow.pose,
    stoop: -(blow.pose.stoop ?? 0),
    ...(blow.pose.hands
      ? {
          hands: {
            left: [15 - blow.pose.hands.right[0], blow.pose.hands.right[1]],
            right: [15 - blow.pose.hands.left[0], blow.pose.hands.left[1]],
          },
        }
      : {}),
  },
  angle: 180 - blow.angle,
});

function work(build: Build, tool: 'axe' | 'spade', toward: 'w' | 'e', frame: number): Grid {
  const blows = tool === 'axe' ? CHOP : DIG;
  const blow = toward === 'w' ? blows[frame % blows.length]! : mirrored(blows[frame % blows.length]!);
  const pose = { ...blow.pose, build };
  const grid = finish(body(pose));
  const [hx, hy] = handOf(pose, toward === 'w' ? 'left' : 'right');
  const from = [Math.round(hx), Math.round(hy)] as const;
  const radians = (blow.angle * Math.PI) / 180;
  const haft = tool === 'axe' ? HATCHET : SHOVEL;
  const to = [Math.round(from[0] + Math.cos(radians) * haft), Math.round(from[1] + Math.sin(radians) * haft)] as const;
  const out = toward === 'w' ? -1 : 1;
  line(grid, from[0], from[1], to[0], to[1], WOOD[2]!);
  if (tool === 'axe') {
    put(grid, to[0], to[1], STONE[5]!);
    put(grid, to[0] + out, to[1], STONE[3]!);
    put(grid, to[0], to[1] + 1, INK);
  } else {
    put(grid, to[0], to[1], STONE[5]!);
    put(grid, to[0] + out, to[1], STONE[4]!);
    put(grid, to[0], to[1] + 1, STONE[2]!);
    put(grid, to[0] + out, to[1] + 1, INK);
    if (blow.clod === 'blade') {
      put(grid, to[0], to[1] - 1, EARTH[3]!);
      put(grid, to[0] + out, to[1] - 1, EARTH[1]!);
    }
    if (blow.clod === 'flying') {
      put(grid, to[0] + out * 2, to[1] - 2, EARTH[3]!);
      put(grid, to[0] + out * 3, to[1] - 1, EARTH[2]!);
    }
  }
  return grid;
}

function drawAs(build: Build) {
  return (_lights: readonly Light[], clip: string, frame: number): Grid => {
    if (clip === 'chop-w' || clip === 'chop-e') return work(build, 'axe', clip === 'chop-w' ? 'w' : 'e', frame);
    if (clip === 'dig-w' || clip === 'dig-e') return work(build, 'spade', clip === 'dig-w' ? 'w' : 'e', frame);
    const poses = CLIPS[clip] ?? CLIPS.idle!;
    return finish(body({ ...(poses[frame % poses.length] ?? poses[0]!), build }));
  };
}

export function drawFigure(_lights: readonly Light[], pose: Pose): Grid {
  return finish(body(pose));
}

const villager = (build: Build): Sprite => ({
  name: `villager-${build}`,
  cells: CELLS,
  clips: [
    { name: 'idle', frames: 2, fps: 2 },
    ...HEADINGS.flatMap((heading) => [
      { name: `walk-${heading}`, frames: STRIDE.length },
      { name: `carry-${heading}`, frames: STRIDE.length },
    ]),
    { name: 'chop-w', frames: CHOP.length, fps: 4 },
    { name: 'chop-e', frames: CHOP.length, fps: 4 },
    { name: 'dig-w', frames: DIG.length, fps: 3 },
    { name: 'dig-e', frames: DIG.length, fps: 3 },
  ],
  lights: [SUN],
  draw: drawAs(build),
});

export const villagerWoman = villager('woman');
export const villagerMan = villager('man');
