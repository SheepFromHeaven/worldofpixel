import type { AnimalModel, Point, Tilt, Vec3 } from '../model.ts';
import { extendModel } from '../archetypes/extend.ts';
import { foreLegPart, hindLegPart, QUADRUPED } from '../archetypes/quadruped.ts';

const FORE_STAGGER = 0.2;

const HOP_LAG = Math.PI * 0.7;

const SPINE_FRONT = 0.17;

const SPINE_REAR = -0.26;

const LOWER = -0.06;

const RUMP = 0.08;

const FORE_REACH = 0.3;

const HIND_FOOT = 0.45;

const HIND_HOCK = 0.25;

const UP: Tilt = { by: 2, max: 1.5, pivot: [-0.2, 0, 0.1] };

const ARM: Tilt = { by: 2, max: 0.3, pivot: [0.14, 0.07, 0.2] };

const spine = (at: Vec3, x: number, z = LOWER): Point => ({ at, flex: { by: 0, x, z } });

const front = (at: Vec3): Point => spine(at, SPINE_FRONT);

const rear = (at: Vec3, share = 1): Point => ({ at, flex: [{ by: 0, x: SPINE_REAR * share }, { by: 1, z: RUMP * share }] });

const foreFoot = (at: Vec3): Point => ({ at, swing: 1, lift: 1, grounded: true, flex: { by: 0, x: FORE_REACH } });

const hindFoot = (at: Vec3, reach: number, share: number): Point => ({ at, swing: share, lift: share, grounded: true, flex: { by: 1, x: reach } });

export const model: AnimalModel = extendModel(QUADRUPED, {
  head: [0.34, 0, 0.38],
  gait: { swing: 0.12, lift: 0.14, byLegs: true, bob: 0.07, bobShape: 1, bobPhase: -Math.PI / 2, roll: 0, stride: 4.4 },
  states: { run: null, bound: { swing: 0, lift: 0, bob: 0, stride: 3.2 } },
  lying: 0.1,
  eyes: [0.4, 0.07, 0.41],
  headTilt: UP,
  eyeFlex: { by: 0, x: SPINE_FRONT, z: LOWER * 0.5 },
  nose: [0.45, 0, 0.36],
  parts: {
    foreLeg: foreLegPart([{ limb: [front([0.14, 0.07, 0.22]), foreFoot([0.17, 0.07, 0.03])], radii: [0.06, 0.04], floor: [1.1, 0.9] }], {
      phase: 0,
      stagger: FORE_STAGGER,
      tilt: [ARM, UP],
      states: { bound: { phase: 0, stagger: 0.1 } },
    }),
    hindLeg: hindLegPart(
      [
        { limb: [rear([-0.16, 0.15, 0.32]), hindFoot([-0.3, 0.15, 0.07], HIND_HOCK, 0.5)], radii: [0.13, 0.06], floor: [2, 1.2] },
        { limb: [hindFoot([-0.3, 0.15, 0.07], HIND_HOCK, 0.5), hindFoot([-0.1, 0.15, 0.03], HIND_FOOT, 1)], radii: [0.05, 0.04], floor: [1.1, 0.9] },
      ],
      { phase: HOP_LAG, stagger: FORE_STAGGER, standing: false, states: { bound: { phase: HOP_LAG, stagger: 0.1 } } },
    ),
  },
  add: [
    {
      kind: 'HEAD',
      depth: 'head',
      tilt: UP,
      shapes: [
        { ellipsoid: spine([0.34, 0, 0.38], SPINE_FRONT, LOWER * 0.5), radii: [0.12, 0.09, 0.1] },
        { ellipsoid: spine([0.43, 0, 0.35], SPINE_FRONT, LOWER * 0.5), radii: [0.06, 0.05, 0.05] },
      ],
    },
    {
      kind: 'BODY',
      tilt: UP,
      shapes: [
        { ellipsoid: rear([-0.14, 0, 0.32]), radii: [0.26, 0.19, 0.24] },
        { ellipsoid: front([0.1, 0, 0.27]), radii: [0.2, 0.15, 0.17] },
        { limb: [rear([-0.05, 0, 0.3]), front([0.2, 0, 0.3])], radii: [0.16, 0.14] },
      ],
    },
    {
      kind: 'TAIL',
      depth: 'self',
      tilt: UP,
      shapes: [
        { limb: [rear([-0.3, 0, 0.34], 1.2), rear([-0.5, 0, 0.46], 1.2)], radii: [0.08, 0.15] },
        { limb: [rear([-0.5, 0, 0.46], 1.2), rear([-0.5, 0, 0.76], 1.2)], radii: [0.15, 0.16] },
        { limb: [rear([-0.5, 0, 0.76], 1.2), { dir: [0.6, 0, 0.7], param: 'tail', k: 0.32, sway: [0, 0.05, 0] }], radii: [0.16, 0.08] },
      ],
    },
    {
      kind: 'EAR',
      tilt: UP,
      mirror: true,
      far: true,
      depth: 'self',
      shapes: [{ limb: [spine([0.3, 0.05, 0.46], 0.12, LOWER * 0.5), { dir: [-0.1, 0.2, 1], param: 'ears', k: 0.9 }], radii: [0.3, 0.16], floor: [1, 0.7], radiiBy: 'reach' }],
    },
  ],
});
