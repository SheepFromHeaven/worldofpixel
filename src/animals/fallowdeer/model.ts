import type { AnimalModel } from '../model.ts';
import { flexHead } from '../archetypes/quadruped.ts';
import { antlerPart, deerModel, tine } from '../archetypes/deer.ts';

export const model: AnimalModel = deerModel({
  head: [0.5, 0, 0.78],
  neck: [0.09, 0.058],
  neckMass: 0.6,
  bodyDepth: 0.17,
  tail: { at: [-0.43, 0, 0.58], dir: [-0.6, 0, -0.5], k: 1.3, radii: [0.045, 0.03] },
  antlers: antlerPart([0.46, 0.04, 0.86], 0.9, [
    tine([0.46, 0.04, 0.86], [0.4, 0.1, 1.0], [0.018, 0.012]),
    tine([0.44, 0.05, 0.93], [0.53, 0.07, 0.99]),
    { ellipsoid: flexHead([0.34, 0.13, 1.1]), radii: [0.055, 0.014, 0.085] },
    tine([0.31, 0.13, 1.15], [0.27, 0.14, 1.27], [0.012, 0.008]),
    tine([0.34, 0.13, 1.17], [0.34, 0.14, 1.28], [0.012, 0.008]),
    tine([0.38, 0.13, 1.14], [0.42, 0.14, 1.24], [0.012, 0.008]),
  ]),
});
