import type { AnimalModel, Part, Vec3 } from '../model.ts';
import { extendModel } from '../archetypes/extend.ts';
import { QUADRUPED } from '../archetypes/quadruped.ts';

export const HOME_STATES = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'] as const;

const MOUND_FROM = 0.15;

const HOLES_FROM = 0.5;

const HOLE_AT: readonly (readonly [number, number])[] = [
  [0.12, 0.1],
  [-0.12, 0.22],
  [-0.08, -0.24],
  [0.22, 0.2],
  [0.24, -0.18],
  [-0.3, 0.02],
  [0.02, 0.32],
  [0.0, -0.34],
];

const ORIGIN: Vec3 = [0, 0, 0];

const holes = (): Part[] =>
  HOLE_AT.flatMap(([x, y], index) => {
    const states = HOME_STATES.slice(index);
    const z = 0.1 + 0.16 * Math.sqrt(Math.max(0.04, 1 - (x * x + y * y) / 0.16));
    const shared = { depth: 'self' as const, bias: 0.12, from: HOLES_FROM, grows: { anchor: ORIGIN, full: 1 }, only: states };
    return [
      { kind: 'TAIL' as const, ...shared, shapes: [{ ellipsoid: [x, y, z - 0.012] as Vec3, radii: [0.1, 0.085, 0.035] as Vec3 }] },
      { kind: 'PATCH' as const, ...shared, shapes: [{ ellipsoid: [x, y, z + 0.004] as Vec3, radii: [0.068, 0.055, 0.03] as Vec3 }] },
    ];
  });

export const model: AnimalModel = extendModel(QUADRUPED, {
  head: [0, 0, 0.1],
  gait: { swing: 0, lift: 0, bob: 0 },
  states: { run: null },
  lying: 0,
  parts: { foreLeg: null, hindLeg: null },
  add: [
    { kind: 'BODY', depth: 'self', when: 'bare', shapes: [{ ellipsoid: [0, 0, 0], radii: [0.42, 0.38, 0.015] }] },
    { kind: 'BODY', depth: 'self', from: MOUND_FROM, grows: { anchor: ORIGIN, full: 1 }, shapes: [{ ellipsoid: [0, 0, 0.02], radii: [0.5, 0.46, 0.1] }] },
    { kind: 'HUMP', depth: 'self', bias: 0.03, from: MOUND_FROM, grows: { anchor: ORIGIN, full: 1 }, shapes: [{ ellipsoid: [0, 0, 0.1], radii: [0.4, 0.36, 0.16] }] },
    { kind: 'FACE', depth: 'self', bias: 0.06, from: MOUND_FROM, grows: { anchor: ORIGIN, full: 1 }, shapes: [{ ellipsoid: [-0.02, 0, 0.22], radii: [0.26, 0.24, 0.14] }] },
    ...holes(),
  ],
});
