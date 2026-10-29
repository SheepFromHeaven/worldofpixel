import type { AnimalModel, Point, Tilt, Vec3 } from '../model.ts';
import { extendModel } from '../archetypes/extend.ts';
import { foreLegPart, hindLegPart, QUADRUPED } from '../archetypes/quadruped.ts';

const FORE_STAGGER = 0.2;

const HOP_LAG = Math.PI * 0.7;

const SPINE_FRONT = 0.17;

const SPINE_REAR = -0.26;

const LOWER = -0.06;

const RUMP = 0.08;

const EARS_LAG = 0.12;

const FORE_REACH = 0.34;

const HIND_FOOT = 0.55;

const HIND_HOCK = 0.3;

const GROOM = ['groom'] as const;

const UP: Tilt = { by: 2, max: 0.95, pivot: [-0.2, 0, 0.15], on: GROOM };

const ARM: Tilt = { by: 2, max: 0.6, pivot: [0.14, 0.07, 0.2], on: GROOM };

const LOOK: Tilt = { by: 1, max: 1.5, pivot: [0.28, 0, 0.35], axis: 'yaw', on: GROOM };

const spine = (at: Vec3, x: number, z = LOWER): Point => ({ at, flex: { by: 0, x, z } });

const front = (at: Vec3): Point => spine(at, SPINE_FRONT);

const rear = (at: Vec3, share = 1): Point => ({ at, flex: [{ by: 0, x: SPINE_REAR * share }, { by: 1, z: RUMP * share, off: GROOM }] });

const foreFoot = (at: Vec3): Point => ({ at, swing: 1, lift: 1, grounded: true, flex: { by: 0, x: FORE_REACH } });

const hindFoot = (at: Vec3, reach: number, share: number): Point => ({ at, swing: share, lift: share, grounded: true, flex: { by: 1, x: reach, off: GROOM } });

export const model: AnimalModel = extendModel(QUADRUPED, {
  head: [0.36, 0, 0.38],
  gait: { swing: 0.12, lift: 0.14, byLegs: true, bob: 0.07, bobShape: 1, bobPhase: -Math.PI / 2, roll: 0, stride: 4.4 },
  states: { run: null, bound: { swing: 0, lift: 0, bob: 0, stride: 7.8 } },
  lying: 0.1,
  sink: 0.55,
  slide: 0.4,
  eyes: [0.42, 0.07, 0.41],
  headTilt: [LOOK, UP],
  eyeFlex: { by: 0, x: SPINE_FRONT, z: LOWER * 0.5 },
  nose: [0.52, 0, 0.35],
  parts: {
    foreLeg: foreLegPart([{ limb: [front([0.14, 0.07, 0.2]), foreFoot([0.17, 0.07, 0.03])], radii: [0.06, 0.04], floor: [1.2, 0.9] }], {
      phase: 0,
      stagger: FORE_STAGGER,
      tilt: [ARM, UP],
      states: { bound: { phase: 0, stagger: 0.1 } },
    }),
    hindLeg: hindLegPart(
      [
        { limb: [rear([-0.2, 0.15, 0.3]), hindFoot([-0.34, 0.15, 0.07], HIND_HOCK, 0.5)], radii: [0.12, 0.06], floor: [2, 1.2] },
        { limb: [hindFoot([-0.34, 0.15, 0.07], HIND_HOCK, 0.5), hindFoot([-0.12, 0.15, 0.03], HIND_FOOT, 1)], radii: [0.05, 0.04], floor: [1.1, 0.9] },
      ],
      { phase: HOP_LAG, stagger: FORE_STAGGER, standing: false, states: { bound: { phase: HOP_LAG, stagger: 0.1 } } },
    ),
  },
  add: [
    {
      kind: 'HEAD',
      depth: 'head',
      tilt: [LOOK, UP],
      shapes: [
        { ellipsoid: spine([0.36, 0, 0.38], SPINE_FRONT, LOWER * 0.5), radii: [0.12, 0.09, 0.1] },
        { ellipsoid: spine([0.47, 0, 0.34], SPINE_FRONT, LOWER * 0.5), radii: [0.07, 0.055, 0.055] },
      ],
    },
    {
      kind: 'BODY',
      tilt: UP,
      shapes: [
        { ellipsoid: rear([-0.18, 0, 0.3]), radii: [0.28, 0.2, 0.24] },
        { ellipsoid: front([0.1, 0, 0.27]), radii: [0.22, 0.16, 0.18] },
        { limb: [rear([-0.05, 0, 0.3]), front([0.2, 0, 0.3])], radii: [0.17, 0.15] },
      ],
    },
    { kind: 'TAIL', depth: 'self', tilt: UP, shapes: [{ ellipsoid: rear([-0.43, 0, 0.32], 1.3), radii: [0.05, 0.05, 0.05] }] },
    {
      kind: 'EAR',
      tilt: [LOOK, UP],
      mirror: true,
      far: true,
      depth: 'self',
      shapes: [{ limb: [spine([0.32, 0.05, 0.46], EARS_LAG, LOWER * 0.5), { dir: [-0.25, 0.3, 0.95], param: 'ears', k: 1.5 }], radii: [0.2, 0.12], floor: [1, 0.7], radiiBy: 'reach' }],
    },
  ],
});
