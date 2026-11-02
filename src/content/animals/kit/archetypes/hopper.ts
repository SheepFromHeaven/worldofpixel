import type { Pose, PoseContext } from '../types.ts';
import { NO_POSE } from '../types.ts';
import { ease } from './behaviours.ts';

const GRAVITY = 9.81;

const TAKEOFF = 0.42;

const CYCLE: readonly (readonly [number, number, number])[] = [
  [0, 1, -1],
  [0.12, 0.6, -0.3],
  [0.32, -0.45, 1],
  [TAKEOFF, 1, -1],
  [0.7, 0.85, -0.85],
  [1, 1, -1],
];

export interface Bounding {
  pace: number;
  speed: number;
  leap: number;
  body: number;
  shown: number;
  sink: number;
}

const keyed = (u: number): readonly [number, number] => {
  const next = CYCLE.findIndex(([at]) => at >= u);
  const to = CYCLE[Math.max(1, next)]!;
  const from = CYCLE[Math.max(0, next - 1)]!;
  const t = ease((u - from[0]) / Math.max(1e-6, to[0] - from[0]));
  return [from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
};

export const boundPose = ({ pace, speed, leap, body, shown, sink }: Bounding) => {
  const airborne = (1 - TAKEOFF) * (leap / (speed * pace));
  const apex = (shown * GRAVITY * airborne ** 2) / 8 / body / sink;
  return (phase: number): Pose => {
    const u = (((phase / (Math.PI * 2)) % 1) + 1) % 1;
    const [spine, hind] = keyed(u);
    if (u < TAKEOFF) return [spine, hind, 0, 0];
    const t = (u - TAKEOFF) / (1 - TAKEOFF);
    return [spine, hind, 0, -apex * 4 * t * (1 - t)];
  };
};

export const withBounding = (pose: (context: PoseContext) => Pose, bounding: Bounding) => {
  const bound = boundPose(bounding);
  return (context: PoseContext): Pose => {
    if (context.state === 'bound') return context.going ? bound(context.phase) : NO_POSE;
    const base = pose(context);
    if (context.state === 'hop') return [0.6 * base[0], 0, base[2], base[3]];
    return base;
  };
};
