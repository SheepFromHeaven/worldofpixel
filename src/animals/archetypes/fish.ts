import type { AnimalModel, Tilt, Vec3 } from '../model.ts';
import type { AnimalBehaviour, FishHabits, Pose, PoseContext } from '../types.ts';
import { extendModel } from './extend.ts';
import { QUADRUPED } from './quadruped.ts';

export const FISH_STATES = ['swim'] as const;

const BEND: Tilt = { by: 1, max: 0.7, pivot: [0.2, 0, 0], axis: 'yaw' };

const RIPPLE: Tilt = { by: 2, max: 0.45, pivot: [0.12, 0, 0], axis: 'yaw' };

const BEAT: Tilt = { by: 0, max: 0.8, pivot: [-0.3, 0, 0], axis: 'yaw' };

export interface Fish {
  width: number;
  tail: { span: number; fork: number };
  fins?: number;
  head?: number;
}

export const fishModel = ({ width, tail, fins = 0.06, head = 0.15 }: Fish): AnimalModel => {
  const back: Tilt[] = [RIPPLE, BEND];
  const rear: Tilt[] = [BEAT, RIPPLE, BEND];
  const flat = (x: number, y: number): Vec3 => [x, y, 0];
  return extendModel(QUADRUPED, {
    view: 'above',
    head: flat(0.4, 0),
    gait: { swing: 0, lift: 0, bob: 0 },
    states: { run: null },
    lying: 0,
    parts: { foreLeg: null, hindLeg: null },
    add: [
      { kind: 'HEAD', tilt: BEND, shapes: [{ ellipsoid: flat(0.38, 0), radii: [head, width * 0.75, 0.03] }] },
      { kind: 'BODY', tilt: BEND, shapes: [{ ellipsoid: flat(0.12, 0), radii: [0.27, width, 0.04] }] },
      { kind: 'BODY', tilt: back, shapes: [{ ellipsoid: flat(-0.14, 0), radii: [0.25, width * 0.7, 0.03] }] },
      { kind: 'BODY', tilt: rear, shapes: [{ limb: [flat(-0.3, 0), flat(-0.46, 0)], radii: [width * 0.4, width * 0.22], floor: [0.6, 0.5] }] },
      {
        kind: 'TAIL',
        tilt: rear,
        shapes: [
          { limb: [flat(-0.46, 0), flat(-0.46 - 0.16 * (0.5 + tail.fork * 0.5), tail.span)], radii: [0.012, 0.03], floor: [0.6, 0.6] },
          { limb: [flat(-0.46, 0), flat(-0.46 - 0.16 * (0.5 + tail.fork * 0.5), -tail.span)], radii: [0.012, 0.03], floor: [0.6, 0.6] },
          { ellipsoid: flat(-0.56, 0), radii: [0.05 * (1 - tail.fork) + 0.015, tail.span * 0.6, 0.01] },
        ],
      },
      { kind: 'WING', mirror: true, tilt: BEND, shapes: [{ limb: [flat(0.22, width * 0.9), flat(0.08, width * 0.9 + fins)], radii: [0.025, 0.012], floor: [0.6, 0.5] }] },
    ],
  });
};

const fishPose = ({ phase }: PoseContext): Pose => [Math.sin(phase), 0, Math.sin(phase - 0.9), 0];

export const fishBehaviour = (habits: FishHabits): AnimalBehaviour<FishHabits> => ({
  habits,
  states: FISH_STATES,
  hooks: { pose: fishPose },
});

export const fishTexture = (key: string): string =>
  `vec3 texture_${key}(float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size) {\n  return fallback;\n}\n`;
