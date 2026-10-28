import type { AnimalModel } from '../model.ts';
import { extendModel } from '../archetypes/extend.ts';
import { foreLegPart, hindLegPart, QUADRUPED } from '../archetypes/quadruped.ts';

export const model: AnimalModel = extendModel(QUADRUPED, {
  head: [0.38, 0, 0.3],
  gait: { swing: 0.11, lift: 0.09, byLegs: false, bob: 0.04 },
  states: { run: { swing: 0.2, lift: 0.14, bob: 0.07 } },
  lying: 0.16,
  sink: 0.5,
  slide: 0.3,
  eyes: [0.4, 0.08, 0.33],
  nose: [0.64, 0, 0.19],
  parts: { foreLeg: foreLegPart([{ limb: [[0.2, 0.13, 0.2], { at: [0.2, 0.13, 0.06], swing: 1, lift: 1, grounded: true }], radii: [0.09, 0.06], floor: [1.5, 1] }]), hindLeg: hindLegPart([{ limb: [[-0.2, 0.13, 0.2], { at: [-0.2, 0.13, 0.069], swing: 1, lift: 1, grounded: true }], radii: [0.1035, 0.069], floor: [1.725, 1.15] }]) },
  add: [
    {
      kind: 'HEAD',
      depth: 'head',
      shapes: [
        { ellipsoid: [0.38, 0, 0.3], radii: [0.12, 0.1, 0.095] },
        { limb: [[0.42, 0, 0.28], [0.64, 0, 0.19]], radii: [0.07, 0.045], floor: [1, 0.8] },
      ],
    },
    {
      kind: 'BODY',
      shapes: [
        { ellipsoid: [-0.12, 0, 0.36], radii: [0.27, 0.2, 0.2] },
        { ellipsoid: [0.14, 0, 0.3], radii: [0.2, 0.17, 0.12] },
        { limb: [[0.2, 0, 0.34], [0.36, 0, 0.3]], radii: [0.1, 0.085] },
      ],
    },
    {
      kind: 'TAIL',
      depth: 'self',
      shapes: [{ limb: [[-0.36, 0, 0.34], { dir: [-0.88, 0, -0.48], param: 'tail', k: 1.3, sway: [0, 1, 0.2] }], radii: [0.12, 0.03], floor: [1.6, 0.7] }],
    },
    {
      kind: 'EAR',
      mirror: true,
      far: true,
      depth: 'self',
      shapes: [{ limb: [[0.3, 0.06, 0.37], { dir: [-0.2, 0.45, 0.9], param: 'ears', k: 1.4 }], radii: [0.24, 0.18], floor: [1, 0.75], radiiBy: 'reach' }],
    },
  ],
});
