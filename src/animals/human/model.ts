import type { AnimalModel, Part } from '../model.ts';

const HIP_WIDTH = 0.06;

const SHOULDER_WIDTH = 0.12;

const leg: Part = {
  name: 'leg',
  kind: 'LEG',
  mirror: true,
  far: true,
  depth: 'self',
  phase: 0,
  shapes: [
    { limb: [[0, HIP_WIDTH, 0.5], { at: [0.01, HIP_WIDTH, 0.27], swing: 0.5, lift: 0.5, grounded: true }], radii: [0.065, 0.045] },
    { limb: [{ at: [0.01, HIP_WIDTH, 0.27], swing: 0.5, lift: 0.5, grounded: true }, { at: [0, HIP_WIDTH, 0.04], swing: 1, lift: 1, grounded: true }], radii: [0.045, 0.032] },
    { ellipsoid: { at: [0.035, HIP_WIDTH, 0.02], swing: 1, lift: 1, grounded: true }, radii: [0.065, 0.032, 0.022] },
  ],
};

const HAND_WIDTH = SHOULDER_WIDTH + 0.035;

const arm: Part = {
  name: 'arm',
  kind: 'EAR',
  mirror: true,
  far: true,
  depth: 'self',
  phase: Math.PI,
  shapes: [
    { limb: [[0, SHOULDER_WIDTH, 0.8], { at: [0, HAND_WIDTH, 0.62], swing: 0.55, lift: 0.15 }], radii: [0.042, 0.032] },
    { limb: [{ at: [0, HAND_WIDTH, 0.62], swing: 0.55, lift: 0.15 }, { at: [0.01, HAND_WIDTH, 0.46], swing: 1.25, lift: 0.4 }], radii: [0.032, 0.026] },
    { ellipsoid: { at: [0.01, HAND_WIDTH, 0.44], swing: 1.25, lift: 0.4 }, radii: [0.026, 0.02, 0.03] },
  ],
};

export const model: AnimalModel = {
  head: [0.01, 0, 0.93],
  gait: { swing: 0.12, lift: 0.04, byLegs: false, bob: 0.012, roll: 0.006, stride: 1.65 },
  lying: 0.4,
  eyes: [0.06, 0.03, 0.94],
  parts: [
    leg,
    arm,
    {
      kind: 'BODY',
      shapes: [
        { ellipsoid: [0, 0, 0.5], radii: [0.075, 0.1, 0.07] },
        { ellipsoid: [0, 0, 0.66], radii: [0.08, 0.115, 0.17] },
        { ellipsoid: [0, 0, 0.775], radii: [0.075, 0.135, 0.06] },
        { limb: [[0, 0, 0.8], [0.005, 0, 0.88]], radii: [0.04, 0.035] },
      ],
    },
    {
      kind: 'HEAD',
      depth: 'head',
      inked: true,
      shapes: [{ ellipsoid: [0.01, 0, 0.94], radii: [0.065, 0.055, 0.075] }],
    },
    { kind: 'FACE', depth: 'head', bias: 0.02, shapes: [{ ellipsoid: [0.045, 0, 0.92], radii: [0.03, 0.045, 0.05] }] },
    {
      kind: 'HUMP',
      depth: 'self',
      shapes: [{ ellipsoid: [-0.035, 0, 0.955], radii: [0.062, 0.062, 0.068] }, { ellipsoid: [0, 0, 0.975], radii: [0.068, 0.062, 0.045] }],
    },
  ],
};
