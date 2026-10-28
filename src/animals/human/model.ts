import type { AnimalModel, Flex, Part, Point, Vec3 } from '../model.ts';

export const CARRY = 0;

export const STOOP = 1;

const HIP_HEIGHT = 0.5;

const STOOP_FORWARD = 0.6;

const STOOP_DOWN = 0.32;

const CROUCH = 0.22;

const HIP_BACK = -0.05;

const HIP_WIDTH = 0.06;

const SHOULDER_WIDTH = 0.12;

const lean = (at: Vec3, extra: readonly Flex[] = []): Point => {
  const above = Math.max(0, at[2] - HIP_HEIGHT);
  return { at, flex: [{ by: STOOP, x: STOOP_FORWARD * above, z: -STOOP_DOWN * above - CROUCH }, ...extra] };
};

const hip: Point = { at: [0, HIP_WIDTH, HIP_HEIGHT], flex: { by: STOOP, x: HIP_BACK, z: -CROUCH } };

const knee: Point = { at: [0.01, HIP_WIDTH, 0.27], swing: 0.5, lift: 0.5, grounded: true, flex: { by: STOOP, x: 0.12, z: -0.12 } };

const leg: Part = {
  name: 'leg',
  kind: 'LEG',
  mirror: true,
  far: true,
  depth: 'self',
  phase: 0,
  shapes: [
    { limb: [hip, knee], radii: [0.065, 0.045] },
    { limb: [knee, { at: [0, HIP_WIDTH, 0.04], swing: 1, lift: 1, grounded: true }], radii: [0.045, 0.032] },
    { ellipsoid: { at: [0.035, HIP_WIDTH, 0.02], swing: 1, lift: 1, grounded: true }, radii: [0.065, 0.032, 0.022] },
  ],
};

const HAND_WIDTH = SHOULDER_WIDTH + 0.035;

const elbow: Point = {
  at: [0, HAND_WIDTH, 0.62],
  swing: 0.55,
  lift: 0.15,
  still: CARRY,
  flex: [
    { by: CARRY, x: 0.07, y: -0.05, z: 0.01 },
    { by: STOOP, x: 0.17, y: -0.03, z: -0.32 },
  ],
};

const hand: Point = {
  at: [0.01, HAND_WIDTH, 0.44],
  swing: 1.25,
  lift: 0.4,
  still: CARRY,
  flex: [
    { by: CARRY, x: 0.18, y: -0.085, z: 0.13 },
    { by: STOOP, x: 0.17, y: -0.06, z: -0.32 },
  ],
};

const arm: Part = {
  name: 'arm',
  kind: 'EAR',
  mirror: true,
  far: true,
  depth: 'self',
  phase: Math.PI,
  shapes: [
    { limb: [lean([0, SHOULDER_WIDTH, 0.8]), elbow], radii: [0.042, 0.032] },
    { limb: [elbow, hand], radii: [0.032, 0.026] },
    { ellipsoid: hand, radii: [0.026, 0.02, 0.03] },
  ],
};

export const model: AnimalModel = {
  head: [0.01, 0, 0.93],
  gait: { swing: 0.12, lift: 0.04, byLegs: false, bob: 0.012, roll: 0.006, stride: 1.65 },
  lying: 0.4,
  eyes: [0.06, 0.03, 0.94],
  eyeFlex: { by: STOOP, x: STOOP_FORWARD * 0.44, z: -STOOP_DOWN * 0.44 - CROUCH },
  parts: [
    leg,
    arm,
    {
      kind: 'BODY',
      shapes: [
        { ellipsoid: { at: [0, 0, 0.5], flex: { by: STOOP, x: HIP_BACK, z: -CROUCH } }, radii: [0.075, 0.1, 0.07] },
        { ellipsoid: lean([0, 0, 0.66]), radii: [0.08, 0.115, 0.17] },
        { ellipsoid: lean([0, 0, 0.775]), radii: [0.075, 0.135, 0.06] },
        { limb: [lean([0, 0, 0.8]), lean([0.005, 0, 0.88])], radii: [0.04, 0.035] },
      ],
    },
    {
      kind: 'HEAD',
      depth: 'head',
      inked: true,
      shapes: [{ ellipsoid: lean([0.01, 0, 0.94]), radii: [0.065, 0.055, 0.075] }],
    },
    { kind: 'FACE', depth: 'head', bias: 0.02, shapes: [{ ellipsoid: lean([0.045, 0, 0.92]), radii: [0.03, 0.045, 0.05] }] },
    {
      kind: 'HUMP',
      depth: 'self',
      shapes: [{ ellipsoid: lean([-0.035, 0, 0.955]), radii: [0.062, 0.062, 0.068] }, { ellipsoid: lean([0, 0, 0.975]), radii: [0.068, 0.062, 0.045] }],
    },
  ],
};
