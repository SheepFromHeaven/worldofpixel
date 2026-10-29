import type { AnimalModel, Part, Vec3 } from '../model.ts';
import { extendModel } from '../archetypes/extend.ts';
import { QUADRUPED } from '../archetypes/quadruped.ts';
import { HOME_STATES } from '../burrow/model.ts';

export { HOME_STATES };

const MOUND_FROM = 0.15;

const HOLE_FROM = 0.5;

const ORIGIN: Vec3 = [0, 0, 0];

const grows = { anchor: ORIGIN, full: 1 };

const hole = (): Part[] => {
  const shared = { depth: 'self' as const, bias: 0.12, from: HOLE_FROM, grows };
  return [
    { kind: 'TAIL' as const, ...shared, shapes: [{ ellipsoid: [0.26, 0, 0.06] as Vec3, radii: [0.13, 0.17, 0.06] as Vec3 }] },
    { kind: 'PATCH' as const, ...shared, shapes: [{ ellipsoid: [0.27, 0, 0.075] as Vec3, radii: [0.085, 0.12, 0.05] as Vec3 }] },
  ];
};

export const model: AnimalModel = extendModel(QUADRUPED, {
  head: [0, 0, 0.1],
  gait: { swing: 0, lift: 0, bob: 0 },
  states: { run: null },
  lying: 0,
  parts: { foreLeg: null, hindLeg: null },
  add: [
    { kind: 'FLOOR', depth: 'self', bias: -0.8, shapes: [{ ellipsoid: [-0.05, 0, 0], radii: [0.74, 0.7, 0.012] }] },
    { kind: 'BODY', depth: 'self', bias: 0.01, from: MOUND_FROM, grows, shapes: [{ ellipsoid: [-0.14, 0, 0.03], radii: [0.5, 0.44, 0.2] }] },
    { kind: 'HUMP', depth: 'self', bias: 0.03, from: MOUND_FROM, grows, shapes: [{ ellipsoid: [-0.2, 0, 0.17], radii: [0.36, 0.3, 0.22] }] },
    { kind: 'FACE', depth: 'self', bias: 0.06, from: MOUND_FROM, grows, shapes: [{ ellipsoid: [-0.22, 0, 0.34], radii: [0.22, 0.18, 0.16] }] },
    { kind: 'HUMP', depth: 'self', bias: 0.02, from: MOUND_FROM, grows, shapes: [{ ellipsoid: [0.34, 0.2, 0.02], radii: [0.2, 0.12, 0.05] }] },
    ...hole(),
  ],
});
