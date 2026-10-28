import type { AnimalModel } from '../model.ts';
import { BODY_TILT, bearModel, lookTiltOf } from '../archetypes/bear.ts';

const HEAD: [number, number, number] = [0.5, 0, 0.35];

export const model: AnimalModel = bearModel({
  drop: { by: 1, z: 0.26 },
  hump: 0,
  head: HEAD,
  headScale: 1.35,
  muzzle: [0.1, 0, -0.05],
  neck: [0.2, 0.16],
  bodyDepth: 0.27,
  ears: { at: [0.47, 0.105, 0.46], radii: [0.05, 0.035, 0.05] },
  extra: [
    {
      kind: 'HUMP',
      tilt: BODY_TILT,
      blend: true,
      depth: 'self',
      bias: 0.15,
      shapes: [
        { ellipsoid: [0.34, 0, 0.3], radii: [0.01, 0.01, 0.01] },
        { ellipsoid: [0.2, 0, 0.38], radii: [0.09, 0.225, 0.27] },
      ],
    },
    {
      kind: 'FACE',
      tilt: lookTiltOf(HEAD),
      mirror: true,
      depth: 'head',
      bias: 0.02,
      shapes: [{ ellipsoid: [0.58, 0.055, 0.38], radii: [0.03, 0.022, 0.032] }],
    },
  ],
});
