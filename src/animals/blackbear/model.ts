import type { AnimalModel } from '../model.ts';
import { bearModel } from '../archetypes/bear.ts';

export const model: AnimalModel = bearModel({
  hump: 0,
  headScale: 1.15,
  bodyDepth: 0.24,
  muzzleFace: true,
  ears: { at: [0.47, 0.095, 0.44], radii: [0.036, 0.03, 0.032] },
});
