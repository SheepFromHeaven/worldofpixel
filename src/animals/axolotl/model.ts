import type { AnimalModel, Part } from '../model.ts';
import { extendModel } from '../archetypes/extend.ts';
import { foreLegPart, hindLegPart, QUADRUPED } from '../archetypes/quadruped.ts';

const GILLS = [
  { dir: [-0.3, 0.8, 0.45], at: [0.3, 0.08, 0.1] },
  { dir: [-0.6, 0.7, 0.2], at: [0.28, 0.09, 0.09] },
  { dir: [-0.85, 0.5, 0.0], at: [0.26, 0.09, 0.08] },
] as const;

const gill = (one: (typeof GILLS)[number]): Part => ({
  kind: 'EAR',
  mirror: true,
  far: true,
  depth: 'self',
  shapes: [{ limb: [[one.at[0], one.at[1], one.at[2]], { dir: [one.dir[0], one.dir[1], one.dir[2]], param: 'ears', k: 0.2, sway: [0.15, 0.25, 0.1] }], radii: [0.022, 0.01], floor: [0.7, 0.45] }],
});

export const model: AnimalModel = extendModel(QUADRUPED, {
  head: [0.38, 0, 0.08],
  gait: { swing: 0.07, lift: 0.04, byLegs: true, bob: 0.008, roll: 0.02, stride: 1.2 },
  states: { run: null },
  lying: 0.07,
  eyes: [0.46, 0.08, 0.11],
  nose: [0.53, 0, 0.07],
  parts: {
    foreLeg: foreLegPart([{ limb: [[0.2, 0.12, 0.07], { at: [0.24, 0.17, 0.02], swing: 1, lift: 1, grounded: true }], radii: [0.035, 0.025], floor: [0.8, 0.6] }], { states: {} }),
    hindLeg: hindLegPart([{ limb: [[-0.15, 0.12, 0.07], { at: [-0.2, 0.17, 0.02], swing: 1, lift: 1, grounded: true }], radii: [0.04, 0.025], floor: [0.9, 0.6] }], { states: {} }),
  },
  add: [
    {
      kind: 'HEAD',
      depth: 'head',
      shapes: [{ ellipsoid: [0.38, 0, 0.08], radii: [0.13, 0.15, 0.065] }],
    },
    {
      kind: 'BODY',
      shapes: [
        { ellipsoid: [0.05, 0, 0.085], radii: [0.24, 0.12, 0.085] },
        { limb: [[-0.1, 0, 0.08], [-0.5, 0, 0.055]], radii: [0.075, 0.02], floor: [1.2, 0.5] },
      ],
    },
    {
      kind: 'TAIL',
      depth: 'self',
      shapes: [{ ellipsoid: [-0.3, 0, 0.11], radii: [0.2, 0.012, 0.07] }],
    },
    ...GILLS.map(gill),
  ],
});
