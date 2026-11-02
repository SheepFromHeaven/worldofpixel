import type { AnimalModel, Part, Point, Shape, Vec3 } from '../model.ts';
import type { Pose, PoseContext } from '../types.ts';
import { NO_POSE } from '../types.ts';

export const QUADRUPED_STATES = ['walk', 'run'] as const;

const GALLOP_STAGGER = 0.5;

const COIL = 0.045;

const HEAD_COUNTER = 0.07;

export const flexFront = (at: Vec3, share = 1): Point => ({ at, flex: { by: 0, z: -COIL * share } });

export const flexRear = (at: Vec3, share = 1): Point => ({ at, flex: { by: 0, z: COIL * share } });

export const flexHead = (at: Vec3): Point => ({ at, flex: { by: 1, z: HEAD_COUNTER } });

export const foreLegPart = (shapes: Shape[], over: Partial<Part> = {}): Part => ({
  name: 'foreLeg',
  kind: 'LEG',
  mirror: true,
  far: true,
  standing: true,
  depth: 'self',
  phase: 0,
  states: { run: { phase: 0, stagger: GALLOP_STAGGER } },
  shapes,
  ...over,
});

export const hindLegPart = (shapes: Shape[], over: Partial<Part> = {}): Part => ({
  name: 'hindLeg',
  kind: 'LEG',
  mirror: true,
  far: true,
  standing: true,
  depth: 'self',
  phase: Math.PI,
  states: { run: { phase: Math.PI * 0.92, stagger: GALLOP_STAGGER } },
  shapes,
  ...over,
});

export const QUADRUPED: AnimalModel = {
  head: [0.4, 0, 0.5],
  gait: { swing: 0.12, lift: 0.07, byLegs: true, bob: 0.03 },
  states: { run: { swing: 0.3, lift: 0.15, bob: 0.06, bobShape: 1, bobPhase: -Math.PI / 2, roll: 0.012, stride: 1.6 } },
  lying: 0.15,
  parts: [
    foreLegPart([{ limb: [[0.2, 0.13, 0.4], { at: [0.2, 0.13, 0.05], swing: 1, lift: 1, grounded: true }], radii: [0.08, 0.05] }]),
    hindLegPart([{ limb: [[-0.2, 0.13, 0.4], { at: [-0.2, 0.13, 0.05], swing: 1, lift: 1, grounded: true }], radii: [0.09, 0.055] }]),
  ],
};

export interface GallopPose {
  steady?: number;
  fast?: readonly string[];
}

export const quadrupedPose = ({ steady = 0.85, fast = ['run'] }: GallopPose = {}) => ({ state, phase, going }: PoseContext): Pose => {
  if (!going || !fast.includes(state)) return NO_POSE;
  return [Math.sin(phase), steady * (0.5 * Math.sin(phase) - 0.5), 0, 0];
};
