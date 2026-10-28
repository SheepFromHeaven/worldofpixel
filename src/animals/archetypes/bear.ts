import type { AnimalModel, Mark, Part, Tilt, Vec3 } from '../model.ts';
import { extendModel } from './extend.ts';
import { foreLegPart, hindLegPart, QUADRUPED } from './quadruped.ts';

const KNEE_SWING = 0.35;

export const BODY_TILT: Tilt = { by: 2, max: 1.5, pivot: [-0.2, 0, 0.3] };

export const HIND_TILT: Tilt = { by: 1, max: 1.5, pivot: [-0.22, 0, 0.34] };

export const lookTiltOf = (head: Vec3): Tilt[] => [{ by: 2, max: -1.1, pivot: [head[0] - 0.06, 0, head[2] + 0.02] }, BODY_TILT];

export interface BearSpec {
  hump?: number;
  head?: Vec3;
  headScale?: number;
  muzzle?: Vec3;
  neck?: readonly [number, number];
  bodyDepth?: number;
  ears?: { at: Vec3; radii: Vec3 };
  tail?: { at: Vec3; dir: Vec3; k: number; radii: readonly [number, number] };
  muzzleFace?: boolean;
  climbs?: boolean;
  hangs?: boolean;
  mark?: Mark;
  extra?: readonly Part[];
}

export const bearModel = ({
  hump = 1,
  head = [0.52, 0, 0.33],
  headScale = 1.25,
  muzzle = [0.16, 0, -0.07],
  neck = [0.17, 0.13],
  bodyDepth = 0.25,
  ears = { at: [0.47, 0.095, 0.435], radii: [0.03, 0.025, 0.026] },
  tail = { at: [-0.48, 0, 0.38], dir: [-0.8, 0, -0.3], k: 1.5, radii: [0.06, 0.04] },
  muzzleFace = false,
  climbs = false,
  hangs = false,
  mark,
  extra = [],
}: BearSpec = {}): AnimalModel => {
  const armTilt = hangs ? [{ by: 2, max: -1.0, pivot: [0.22, 0, 0.34] } as Tilt, BODY_TILT] : BODY_TILT;
  const foreUpper: Part = foreLegPart(
    [{ limb: [[0.22, 0.14, 0.34], { at: [0.24, 0.14, 0.15], swing: KNEE_SWING }], radii: [0.13, 0.085] }],
    { name: 'foreUpper', far: false, standing: false, depth: 'self', blend: true, tilt: armTilt },
  );
  const foreLeg: Part = foreLegPart(
    [
      { limb: [{ at: [0.24, 0.14, 0.15], swing: KNEE_SWING }, { at: [0.24, 0.14, 0.04], swing: 1, lift: 1, grounded: true }], radii: [0.085, 0.07], floor: [1.7, 1.4] },
      { ellipsoid: { at: [0.27, 0.14, 0.04], swing: 1, lift: 1, grounded: true }, radii: [0.1, 0.07, 0.04] },
    ],
    { blend: true, tilt: armTilt },
  );
  const hindUpper: Part = hindLegPart(
    [{ limb: [[-0.22, 0.15, 0.34], { at: [-0.28, 0.15, 0.15], swing: KNEE_SWING, lift: 0.5, grounded: true }], radii: [0.16, 0.09] }],
    { name: 'hindUpper', far: false, standing: false, depth: 'self', blend: true, tilt: HIND_TILT },
  );
  const hindLeg: Part = hindLegPart(
    [
      { limb: [{ at: [-0.28, 0.15, 0.15], swing: KNEE_SWING, lift: 0.5, grounded: true }, { at: [-0.22, 0.15, 0.04], swing: 1, lift: 1, grounded: true }], radii: [0.09, 0.075], floor: [1.8, 1.5] },
      { ellipsoid: { at: [-0.18, 0.15, 0.04], swing: 1, lift: 1, grounded: true }, radii: [0.11, 0.075, 0.04] },
    ],
    { blend: true, tilt: HIND_TILT },
  );
  const body: Part = {
    kind: 'BODY',
    blend: true,
    tilt: BODY_TILT,
    ...(mark ? { mark: true } : {}),
    shapes: [
      { ellipsoid: [-0.2, 0, 0.34], radii: [0.3, 0.22, bodyDepth - 0.01] },
      { ellipsoid: [0, 0, 0.36], radii: [0.28, 0.22, bodyDepth] },
      { ellipsoid: [0.2, 0, 0.38], radii: [0.22, 0.21, bodyDepth] },
      ...(hump > 0 ? [{ ellipsoid: [0.16, 0, 0.38 + 0.12 * hump] as Vec3, radii: [0.17, 0.13, 0.14] as Vec3 }] : []),
      { limb: [[0.3, 0, 0.4], [head[0] - 0.06, 0, head[2] + 0.02]], radii: neck },
    ],
  };
  const muzzleShape = { limb: [[head[0] + 0.04, 0, head[2] - 0.02], [head[0] + muzzle[0], 0, head[2] + muzzle[2]]], radii: [0.07 * headScale, 0.05 * headScale], floor: [1.3, 1] } as const;
  const lookTilt = lookTiltOf(head);
  const skull: Part = {
    kind: 'HEAD',
    depth: 'head',
    bias: 0.05,
    inked: true,
    tilt: lookTilt,
    shapes: [{ ellipsoid: head, radii: [0.12 * headScale, 0.1 * headScale, 0.1 * headScale] }, ...(muzzleFace ? [] : [muzzleShape])],
  };
  const face: Part[] = muzzleFace ? [{ kind: 'FACE', depth: 'head', bias: 0.06, inked: true, tilt: lookTilt, shapes: [muzzleShape] }] : [];
  return extendModel(QUADRUPED, {
    head,
    gait: { swing: 0.1, lift: 0.06, byLegs: true, bob: 0.03, roll: 0.02 },
    states: { run: { swing: 0.26, lift: 0.15, bob: 0.07, roll: 0.02 }, ...(climbs ? { climb: { swing: 0.1, lift: 0.04, bob: 0, roll: 0, stride: 1.4 } } : {}) },
    lying: 0.3,
    headTilt: lookTilt,
    ...(mark ? { mark } : {}),
    eyes: [head[0] + 0.05, 0.055, head[2] + 0.04],
    nose: [head[0] + muzzle[0] + 0.01, 0, head[2] + muzzle[2]],
    parts: { foreLeg, hindLeg },
    add: [
      foreUpper,
      hindUpper,
      body,
      skull,
      ...face,
      { kind: 'TAIL', depth: 'self', tilt: BODY_TILT, shapes: [{ limb: [tail.at, { dir: tail.dir, param: 'tail', k: tail.k, sway: [0, 1, 0.2] }], radii: tail.radii, floor: [1.2, 1] }] },
      { kind: 'EAR', mirror: true, far: false, depth: 'head', bias: 0.08, blend: true, tilt: lookTilt, shapes: [{ ellipsoid: ears.at, radii: ears.radii }] },
      ...extra,
    ],
  });
};
