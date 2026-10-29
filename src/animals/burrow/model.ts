import type { AnimalModel, Part, Vec3 } from '../model.ts';
import { extendModel } from '../archetypes/extend.ts';
import { QUADRUPED } from '../archetypes/quadruped.ts';

export const HOME_STATES = ['entrance'] as const;

const MOUND_FROM = 0.15;

const HOLES_FROM = 0.5;

const ORIGIN: Vec3 = [0, 0, 0];

const hole = (): Part[] => {
  const shared = { depth: 'self' as const, bias: 0.12, from: HOLES_FROM, grows: { anchor: ORIGIN, full: 1 } };
  return [
    { kind: 'TAIL' as const, ...shared, shapes: [{ ellipsoid: [0.1, 0.06, 0.2] as Vec3, radii: [0.17, 0.14, 0.05] as Vec3 }] },
    { kind: 'PATCH' as const, ...shared, shapes: [{ ellipsoid: [0.1, 0.06, 0.22] as Vec3, radii: [0.12, 0.1, 0.04] as Vec3 }] },
  ];
};

export const model: AnimalModel = extendModel(QUADRUPED, {
  head: [0, 0, 0.1],
  gait: { swing: 0, lift: 0, bob: 0 },
  states: { run: null },
  lying: 0,
  parts: { foreLeg: null, hindLeg: null },
  add: [
    { kind: 'BODY', depth: 'self', shapes: [{ ellipsoid: [0.04, 0, 0], radii: [0.7, 0.62, 0.012] }] },
    { kind: 'BODY', depth: 'self', bias: 0.01, from: MOUND_FROM, grows: { anchor: ORIGIN, full: 1 }, shapes: [{ ellipsoid: [0, 0, 0.02], radii: [0.46, 0.42, 0.14] }] },
    { kind: 'HUMP', depth: 'self', bias: 0.03, from: MOUND_FROM, grows: { anchor: ORIGIN, full: 1 }, shapes: [{ ellipsoid: [0, 0, 0.12], radii: [0.34, 0.3, 0.16] }] },
    { kind: 'FACE', depth: 'self', bias: 0.06, from: MOUND_FROM, grows: { anchor: ORIGIN, full: 1 }, shapes: [{ ellipsoid: [-0.04, 0, 0.24], radii: [0.22, 0.2, 0.12] }] },
    ...hole(),
  ],
});
