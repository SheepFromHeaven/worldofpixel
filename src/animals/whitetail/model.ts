import type { AnimalModel } from '../model.ts';
import { antlerPart, deerModel, tine } from '../archetypes/deer.ts';

export const model: AnimalModel = deerModel({
  neckMass: 0.7,
  tail: { at: [-0.43, 0, 0.6], dir: [-0.5, 0, 0.25], k: 1.6, radii: [0.065, 0.05] },
  antlers: antlerPart([0.46, 0.035, 0.87], 1, [
    tine([0.46, 0.035, 0.87], [0.43, 0.1, 1.0], [0.018, 0.012]),
    tine([0.43, 0.1, 1.0], [0.52, 0.135, 1.09], [0.016, 0.011]),
    tine([0.52, 0.135, 1.09], [0.6, 0.15, 1.12], [0.012, 0.008]),
    tine([0.45, 0.11, 1.02], [0.45, 0.12, 1.14]),
    tine([0.5, 0.13, 1.07], [0.5, 0.14, 1.18]),
    tine([0.56, 0.145, 1.1], [0.56, 0.15, 1.2], [0.01, 0.007]),
    tine([0.45, 0.045, 0.92], [0.53, 0.06, 0.98]),
  ]),
});
