import type { AnimalModel, Tilt, Vec3 } from '../model.ts';
import { extendModel } from '../archetypes/extend.ts';
import { hindLegPart, QUADRUPED } from '../archetypes/quadruped.ts';

const SHOULDER: Vec3 = [0.1, 0.1, 0.5];

const FLYING = ['fly'] as const;

const SINGING = ['sing'] as const;

const SPREAD: Tilt = { by: 1, max: -1.45, pivot: SHOULDER, axis: 'spread', on: FLYING };

const FLAP: Tilt = { by: 0, max: 0.85, pivot: SHOULDER, axis: 'roll', on: FLYING };

const LIFT: Tilt = { by: 1, max: 0.35, pivot: [0.2, 0, 0.44], on: SINGING };

const GAPE: Tilt = { by: 0, max: -0.5, pivot: [0.42, 0, 0.6], on: SINGING };

const PITCH: Tilt = { by: 2, max: 0.9, pivot: [0, 0, 0.4] };

const HEAD: Vec3 = [0.32, 0, 0.6];

export const model: AnimalModel = extendModel(QUADRUPED, {
  head: HEAD,
  gait: { swing: 0.1, lift: 0.1, byLegs: false, bob: 0.06, stride: 2 },
  states: { run: null, hop: { swing: 0.14, lift: 0.12, bob: 0.07, stride: 2 }, fly: { swing: 0, lift: 0, bob: 0, stride: 1 } },
  lying: 0.1,
  eyes: [0.4, 0.075, 0.63],
  headTilt: [LIFT, PITCH],
  mark: { at: [0.2, 0, 0.48], radii: [0.2, 0.18, 0.18] },
  parts: {
    foreLeg: null,
    hindLeg: hindLegPart([{ limb: [{ at: [0.02, 0.06, 0.24] }, { at: [0.04, 0.06, 0.01], swing: 1, lift: 1, grounded: true }], radii: [0.03, 0.02], floor: [0.8, 0.7] }], { phase: 0, stagger: 0, states: {} }),
  },
  add: [
    { kind: 'BODY', mark: true, tilt: PITCH, blend: true, shapes: [{ ellipsoid: [0, 0, 0.38], radii: [0.34, 0.17, 0.2] }] },
    { kind: 'BODY', tilt: PITCH, blend: true, shapes: [{ ellipsoid: [0.2, 0, 0.5], radii: [0.16, 0.14, 0.16] }] },
    { kind: 'HEAD', depth: 'head', tilt: [LIFT, PITCH], shapes: [{ ellipsoid: HEAD, radii: [0.13, 0.11, 0.12] }] },
    { kind: 'FACE', depth: 'head', tilt: [LIFT, PITCH], shapes: [{ ellipsoid: [0.38, 0, 0.58], radii: [0.09, 0.09, 0.09] }] },
    { kind: 'BILL', depth: 'head', tilt: [LIFT, PITCH], shapes: [{ limb: [[0.42, 0, 0.61], [0.54, 0, 0.6]], radii: [0.03, 0.01], floor: [0.5, 0.4] }] },
    { kind: 'BILL', depth: 'head', tilt: [GAPE, LIFT, PITCH], shapes: [{ limb: [[0.42, 0, 0.59], [0.53, 0, 0.57]], radii: [0.025, 0.01], floor: [0.5, 0.4] }] },
    { kind: 'TAIL', depth: 'self', tilt: PITCH, shapes: [{ limb: [[-0.3, 0, 0.4], [-0.56, 0, 0.34]], radii: [0.06, 0.045], floor: [0.7, 0.6] }] },
    {
      kind: 'WING',
      mirror: true,
      far: true,
      depth: 'self',
      tilt: [SPREAD, FLAP, PITCH],
      shapes: [{ limb: [[SHOULDER[0], 0.14, SHOULDER[2]], [-0.2, 0.15, 0.43]], radii: [0.08, 0.03], floor: [0.9, 0.6] }],
    },
  ],
});
