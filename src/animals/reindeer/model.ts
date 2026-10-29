import type { AnimalModel } from '../model.ts';
import { flexHead } from '../archetypes/quadruped.ts';
import { antlerPart, deerModel, tine } from '../archetypes/deer.ts';

export const model: AnimalModel = deerModel({
  head: [0.5, 0, 0.78],
  neck: [0.1, 0.064],
  bodyDepth: 0.185,
  tail: { at: [-0.43, 0, 0.58], dir: [-0.6, 0, -0.5], k: 1.2, radii: [0.05, 0.03] },
  antlers: antlerPart([0.47, 0.035, 0.84], 1.5, [
    tine([0.47, 0.035, 0.84], [0.37, 0.09, 1.04], [0.022, 0.014]),
    tine([0.37, 0.09, 1.04], [0.31, 0.13, 1.26], [0.016, 0.011]),
    tine([0.31, 0.13, 1.26], [0.38, 0.17, 1.42], [0.012, 0.008]),
    tine([0.46, 0.04, 0.89], [0.56, 0.07, 1.04], [0.016, 0.011]),
    { ellipsoid: flexHead([0.56, 0.07, 1.05]), radii: [0.04, 0.012, 0.05] },
    tine([0.34, 0.11, 1.14], [0.25, 0.15, 1.3], [0.012, 0.008]),
    tine([0.33, 0.115, 1.18], [0.42, 0.15, 1.3], [0.012, 0.008]),
    tine([0.31, 0.13, 1.26], [0.24, 0.17, 1.42], [0.01, 0.007]),
  ]),
});
