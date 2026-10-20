import { layer, line, stamp } from '../grid.ts';
import type { Grid, Stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { INK, STONE, WOOD } from '../palette.ts';
import { drawFigure, handOf } from './villager.ts';
import type { Build, Pose } from './villager.ts';

/**
 * A villager at work inside a land work's tile, and the tool in its hands.
 *
 * The figure is the villager sprite itself, posed — the same person who walks the roads, lit by
 * the same sun — laid over the building it is standing in. A land work is only drawn with a
 * figure in it while someone is working it; the rest of the time the villager is out on the map
 * and the tool lies where it was left.
 */
export interface Stance {
  /** How far the upper body bends towards the work, in cells; negative is to the left. */
  stoop: number;
  /** Where the hands are, in the figure's own cells. Omitted, the arms hang at its sides. */
  hands?: { left: readonly [number, number]; right: readonly [number, number] };
}

const poseOf = (stance: Stance, build: Build = 'woman'): Pose => ({
  swing: 0,
  bob: 0,
  stoop: stance.stoop,
  build,
  ...(stance.hands ? { hands: stance.hands } : {}),
});

/**
 * A land work's clips: standing empty, and at work with either villager in it — the building has
 * to show the same person who walked in, so it carries a work clip for each.
 */
export const workClips = (frames: number, fps: number) => [
  { name: 'default', frames: 1 },
  { name: 'work', frames, fps },
  { name: 'work-man', frames, fps },
];

/** Which villager a clip shows at work, or null for the building standing empty. */
export const workerIn = (clip: string): Build | null =>
  clip === 'work' ? 'woman' : clip === 'work-man' ? 'man' : null;

/** Lays the figure over the tile with its own top-left at `x, y`. */
export function worker(grid: Grid, lights: readonly Light[], x: number, y: number, stance: Stance, build: Build): void {
  layer(grid, drawFigure(lights, poseOf(stance, build)), x, y);
}

/**
 * Where the figure's leading hand is in the tile — the one a haft or a rope is held in. Read off
 * the figure rather than written beside it, because the arm decides how far the hand reaches and
 * a grip placed by hand drifts off the end of an arm the first time the arm changes.
 */
export function grip(x: number, y: number, stance: Stance): [number, number] {
  const [hx, hy] = handOf(poseOf(stance), 'left');
  return [Math.round(x + hx), Math.round(y + hy)];
}

/**
 * How long each tool's haft is, hand to head, in cells. Fixed for every frame: placed by its
 * head instead, the haft grew and shrank between frames as the hands moved, and an axe that is
 * a different length on the upswing is not one axe. A spade is longer than an axe — at an
 * axe's length it was a trowel.
 */
export const AXE_HAFT = 4;
export const SPADE_HAFT = 6;

/**
 * A tool on a haft `haft` cells long, held at `from` and pointing `degrees` round from the right
 * (90 is straight down): a line of wood to the business end and the head stamped there. Drawn after the figure,
 * so the haft crosses the hands holding it. Returns where the head ended up.
 */
export function tool(
  grid: Grid,
  from: readonly [number, number],
  degrees: number,
  head: Stamp,
  haft: number,
): [number, number] {
  const angle = (degrees * Math.PI) / 180;
  const to: [number, number] = [Math.round(from[0] + Math.cos(angle) * haft), Math.round(from[1] + Math.sin(angle) * haft)];
  line(grid, from[0], from[1], to[0], to[1], WOOD[2]!);
  stamp(grid, to[0], to[1], head);
  return to;
}

/** An axe head: a lit cheek of iron and its dark edge. */
export const AXE_HEAD: Stamp = [
  [-1, -1, STONE[6]!], [0, -1, STONE[5]!],
  [-1, 0, STONE[4]!], [0, 0, STONE[3]!], [1, 0, INK],
  [-1, 1, INK], [0, 1, INK],
];

/** A spade blade, empty. */
export const BLADE: Stamp = [
  [-1, 0, STONE[5]!], [0, 0, STONE[4]!], [1, 0, INK],
  [-1, 1, STONE[3]!], [0, 1, STONE[2]!], [1, 1, INK],
];
