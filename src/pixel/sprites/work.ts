import { layer, line, stamp } from '../grid.ts';
import type { Grid, Stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { INK, STONE, WOOD } from '../palette.ts';
import { drawFigure, handOf } from './villager.ts';
import type { Build, Pose } from './villager.ts';

export interface Stance {
  stoop: number;
  hands?: { left: readonly [number, number]; right: readonly [number, number] };
}

const poseOf = (stance: Stance, build: Build = 'woman'): Pose => ({
  swing: 0,
  bob: 0,
  stoop: stance.stoop,
  build,
  ...(stance.hands ? { hands: stance.hands } : {}),
});

export const workClips = (frames: number, fps: number) => [
  { name: 'default', frames: 1 },
  { name: 'work', frames, fps },
  { name: 'work-man', frames, fps },
];

export const workerIn = (clip: string): Build | null =>
  clip === 'work' ? 'woman' : clip === 'work-man' ? 'man' : null;

export function worker(grid: Grid, lights: readonly Light[], x: number, y: number, stance: Stance, build: Build): void {
  layer(grid, drawFigure(lights, poseOf(stance, build)), x, y);
}

export function grip(x: number, y: number, stance: Stance): [number, number] {
  const [hx, hy] = handOf(poseOf(stance), 'left');
  return [Math.round(x + hx), Math.round(y + hy)];
}

export const AXE_HAFT = 4;
export const SPADE_HAFT = 6;

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

export const AXE_HEAD: Stamp = [
  [-1, -1, STONE[6]!], [0, -1, STONE[5]!],
  [-1, 0, STONE[4]!], [0, 0, STONE[3]!], [1, 0, INK],
  [-1, 1, INK], [0, 1, INK],
];

export const BLADE: Stamp = [
  [-1, 0, STONE[5]!], [0, 0, STONE[4]!], [1, 0, INK],
  [-1, 1, STONE[3]!], [0, 1, STONE[2]!], [1, 1, INK],
];
