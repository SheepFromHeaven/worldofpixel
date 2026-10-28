import type { AnimalModel } from '../model.ts';
import { extendModel } from '../archetypes/extend.ts';
import { flexFront, flexHead, flexRear, foreLegPart, hindLegPart, QUADRUPED } from '../archetypes/quadruped.ts';

const FORE_STAGGER = 0.2;

const HOP_LAG = Math.PI * 0.7;

export const model: AnimalModel = extendModel(QUADRUPED, {
  head: [0.36, 0, 0.38],
  gait: { swing: 0.12, lift: 0.14, byLegs: true, bob: 0.07, bobShape: 1, bobPhase: -Math.PI / 2, roll: 0, stride: 4.4 },
  states: { run: null, bound: { swing: 0.2, lift: 0.22, bob: 0.13, stride: 5.3 } },
  lying: 0.1,
  sink: 0.55,
  slide: 0.4,
  eyes: [0.42, 0.07, 0.41],
  nose: [0.52, 0, 0.35],
  parts: {
    foreLeg: foreLegPart([{ limb: [flexFront([0.14, 0.07, 0.2], 1.5), { at: [0.17, 0.07, 0.03], swing: 1, lift: 1, grounded: true }], radii: [0.06, 0.04], floor: [1.2, 0.9] }], {
      phase: 0,
      stagger: FORE_STAGGER,
      states: { bound: { phase: 0, stagger: 0.1 } },
    }),
    hindLeg: hindLegPart(
      [
        { limb: [flexRear([-0.2, 0.12, 0.3], 1.5), { at: [-0.34, 0.12, 0.07], swing: 0.5, lift: 0.5, grounded: true }], radii: [0.12, 0.06], floor: [2, 1.2] },
        { limb: [{ at: [-0.34, 0.12, 0.07], swing: 0.5, lift: 0.5, grounded: true }, { at: [-0.12, 0.12, 0.03], swing: 1, lift: 1, grounded: true }], radii: [0.05, 0.04], floor: [1.1, 0.9] },
      ],
      { phase: HOP_LAG, stagger: FORE_STAGGER, standing: false, states: { bound: { phase: HOP_LAG, stagger: 0.1 } } },
    ),
  },
  add: [
    {
      kind: 'HEAD',
      depth: 'head',
      shapes: [
        { ellipsoid: flexHead([0.36, 0, 0.38]), radii: [0.12, 0.09, 0.1] },
        { ellipsoid: flexHead([0.47, 0, 0.34]), radii: [0.07, 0.055, 0.055] },
      ],
    },
    {
      kind: 'BODY',
      shapes: [
        { ellipsoid: flexRear([-0.18, 0, 0.3], 1.5), radii: [0.28, 0.2, 0.24] },
        { ellipsoid: flexFront([0.1, 0, 0.27], 1.5), radii: [0.22, 0.16, 0.18] },
        { limb: [flexRear([-0.05, 0, 0.3]), flexFront([0.2, 0, 0.3])], radii: [0.17, 0.15] },
      ],
    },
    { kind: 'TAIL', depth: 'self', shapes: [{ ellipsoid: flexRear([-0.43, 0, 0.32], 1.5), radii: [0.05, 0.05, 0.05] }] },
    {
      kind: 'EAR',
      mirror: true,
      far: true,
      depth: 'self',
      shapes: [{ limb: [flexHead([0.32, 0.05, 0.46]), { dir: [-0.25, 0.3, 0.95], param: 'ears', k: 1.5 }], radii: [0.2, 0.12], floor: [1, 0.7], radiiBy: 'reach' }],
    },
  ],
});
