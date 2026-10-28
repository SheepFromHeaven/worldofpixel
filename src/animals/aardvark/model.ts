import type { AnimalModel, Part, Tilt } from '../model.ts';
import { extendModel } from '../archetypes/extend.ts';
import { foreLegPart, hindLegPart, QUADRUPED } from '../archetypes/quadruped.ts';

const KNEE_SWING = 0.4;

const NOD: Tilt = { by: 1, max: -0.9, pivot: [0.3, 0, 0.3] };

const foreUpper: Part = foreLegPart(
  [{ limb: [[0.2, 0.13, 0.3], { at: [0.22, 0.13, 0.15], swing: KNEE_SWING }], radii: [0.12, 0.075] }],
  { name: 'foreUpper', far: false, standing: false, depth: 'self', blend: true },
);

const foreLeg: Part = foreLegPart(
  [
    { limb: [{ at: [0.22, 0.13, 0.15], swing: KNEE_SWING }, { at: [0.2, 0.13, 0.05], swing: 1, lift: 1, grounded: true }], radii: [0.07, 0.055], floor: [1.5, 1.2] },
    { ellipsoid: { at: [0.22, 0.13, 0.05], swing: 1, lift: 1, grounded: true }, radii: [0.075, 0.05, 0.04] },
  ],
  { blend: true },
);

const hindUpper: Part = hindLegPart(
  [{ limb: [[-0.2, 0.15, 0.36], { at: [-0.26, 0.15, 0.16], swing: KNEE_SWING, lift: 0.5, grounded: true }], radii: [0.15, 0.08] }],
  { name: 'hindUpper', far: false, standing: false, depth: 'self', blend: true, still: ['dig'] },
);

const hindLeg: Part = hindLegPart(
  [
    { limb: [{ at: [-0.26, 0.15, 0.16], swing: KNEE_SWING, lift: 0.5, grounded: true }, { at: [-0.2, 0.15, 0.05], swing: 1, lift: 1, grounded: true }], radii: [0.075, 0.06], floor: [1.7, 1.3] },
    { ellipsoid: { at: [-0.2, 0.15, 0.05], swing: 1, lift: 1, grounded: true }, radii: [0.085, 0.055, 0.04] },
  ],
  { blend: true, still: ['dig'] },
);

export const model: AnimalModel = extendModel(QUADRUPED, {
  head: [0.4, 0, 0.28],
  gait: { swing: 0.11, lift: 0.09, byLegs: false, bob: 0.04 },
  states: { run: { swing: 0.2, lift: 0.14, bob: 0.07 }, dig: { swing: 0.2, lift: 0.12, bob: 0.012, roll: 0 } },
  driven: { state: 'dig', phase: 0, amount: 1 },
  headTilt: NOD,
  lying: 0.16,
  sink: 0.5,
  slide: 0.3,
  eyes: [0.42, 0.075, 0.31],
  nose: [0.67, 0, 0.19],
  parts: { foreLeg, hindLeg },
  add: [
    { kind: 'TUSK', only: ['dig'], depth: 'body', bias: -0.1, shapes: [{ ellipsoid: [0.02, 0, 0.03], radii: [0.2, 0.17, 0.05] }] },
    foreUpper,
    hindUpper,
    {
      kind: 'BODY',
      blend: true,
      shapes: [
        { ellipsoid: [-0.14, 0, 0.38], radii: [0.28, 0.2, 0.2] },
        { ellipsoid: [0.02, 0, 0.34], radii: [0.22, 0.18, 0.17] },
        { ellipsoid: [0.2, 0, 0.3], radii: [0.18, 0.15, 0.14] },
        { limb: [[0.24, 0, 0.32], [0.36, 0, 0.3]], radii: [0.11, 0.09] },
      ],
    },
    {
      kind: 'HEAD',
      depth: 'head',
      tilt: NOD,
      shapes: [
        { ellipsoid: [0.4, 0, 0.28], radii: [0.11, 0.08, 0.09] },
        { limb: [[0.44, 0, 0.27], [0.67, 0, 0.19]], radii: [0.07, 0.042], floor: [1, 0.8] },
      ],
    },
    {
      kind: 'TAIL',
      depth: 'self',
      shapes: [{ limb: [[-0.38, 0, 0.36], { dir: [-0.88, 0, -0.48], param: 'tail', k: 1.3, sway: [0, 1, 0.2] }], radii: [0.13, 0.03], floor: [1.6, 0.7] }],
    },
    {
      kind: 'EAR',
      tilt: NOD,
      mirror: true,
      far: true,
      depth: 'self',
      shapes: [{ limb: [[0.31, 0.06, 0.38], { dir: [-0.2, 0.45, 0.9], param: 'ears', k: 1.4 }], radii: [0.24, 0.18], floor: [1, 0.75], radiiBy: 'reach' }],
    },
  ],
});
