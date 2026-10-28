import type { AnimalModel } from '../model.ts';
import { bearModel } from '../archetypes/bear.ts';

export const model: AnimalModel = bearModel({
  hump: 0,
  head: [0.58, 0, 0.35],
  headScale: 1.05,
  muzzle: [0.15, 0, -0.05],
  neck: [0.15, 0.1],
  bodyDepth: 0.22,
  ears: { at: [0.55, 0.075, 0.43], radii: [0.024, 0.02, 0.022] },
});
