import type { AnimalModel, Part, Vec3 } from '../model.ts';
import { extendModel } from '../archetypes/extend.ts';
import { flexFront, flexHead, flexRear, foreLegPart, hindLegPart, QUADRUPED } from '../archetypes/quadruped.ts';

const JOINT: Vec3 = [0.14, 0.14, 0.14];

const ARM_LAG = 0.9;

const COIL_SHARE = 0.5;

const front = flexFront;

const rear = flexRear;

const headed = flexHead;

const arm: Part = foreLegPart(
  [
    { ellipsoid: front([0.14, 0.2, 0.7]), radii: JOINT },
    { limb: [front([0.14, 0.2, 0.7]), { at: [0.19, 0.3, 0.4], swing: 0.4, flex: { by: 0, z: -0.045 * COIL_SHARE } }], radii: [0.15, 0.1] },
    { limb: [{ at: [0.19, 0.3, 0.4], swing: 0.4, flex: { by: 0, z: -0.045 * COIL_SHARE } }, { at: [0.3, 0.28, 0.05], swing: 1, lift: 1, grounded: true }], radii: [0.095, 0.075] },
    { ellipsoid: { at: [0.3, 0.28, 0.07], swing: 1, lift: 1, grounded: true }, radii: [0.075, 0.06, 0.05] },
  ],
  { phase: ARM_LAG, states: { run: { phase: 0, stagger: 0.5 } } },
);

const leg: Part = hindLegPart(
  [
    { ellipsoid: rear([-0.3, 0.15, 0.46]), radii: JOINT },
    { limb: [rear([-0.3, 0.15, 0.46]), { at: [-0.18, 0.22, 0.22], swing: 0.4, lift: 0.5, grounded: true, flex: { by: 0, z: 0.045 * 0.4 } }], radii: [0.15, 0.09] },
    { limb: [{ at: [-0.18, 0.22, 0.22], swing: 0.4, lift: 0.5, grounded: true }, { at: [-0.2, 0.2, 0.03], swing: 1, lift: 1, grounded: true }], radii: [0.085, 0.06] },
    { ellipsoid: { at: [-0.16, 0.2, 0.03], swing: 1, lift: 1, grounded: true }, radii: [0.09, 0.05, 0.03] },
  ],
  { standing: false },
);

export const model: AnimalModel = extendModel(QUADRUPED, {
  head: [0.47, 0, 0.72],
  gait: { swing: 0.14, lift: 0.06, bob: 0.02, roll: 0.02 },
  states: { run: { swing: 0.32, lift: 0.17, bob: 0.07, roll: 0.015 } },
  lying: 0.2,
  mark: { at: [-0.12, 0, 0.8], radii: [0.26, 0.2, 0.2] },
  eyes: [0.58, 0.05, 0.73],
  parts: { foreLeg: arm, hindLeg: leg },
  add: [
    {
      kind: 'HEAD',
      depth: 'head',
      inked: true,
      shapes: [
        { ellipsoid: headed([0.47, 0, 0.72]), radii: [0.13, 0.11, 0.12] },
        { ellipsoid: headed([0.45, 0, 0.83]), radii: [0.1, 0.03, 0.07] },
        { ellipsoid: headed([0.56, 0, 0.74]), radii: [0.04, 0.1, 0.03] },
      ],
    },
    { kind: 'FACE', depth: 'head', bias: 0.01, inked: true, shapes: [{ ellipsoid: headed([0.58, 0, 0.66]), radii: [0.08, 0.08, 0.065] }] },
    {
      kind: 'HUMP',
      mark: true,
      shapes: [
        { ellipsoid: [-0.02, 0, 0.6], radii: [0.34, 0.25, 0.28] },
        { ellipsoid: rear([-0.3, 0, 0.5]), radii: [0.2, 0.2, 0.19] },
        { ellipsoid: front([0.14, 0, 0.76]), radii: [0.2, 0.29, 0.19] },
        { limb: [front([0.2, 0, 0.74]), headed([0.46, 0, 0.7])], radii: [0.16, 0.12] },
      ],
    },
  ],
});
