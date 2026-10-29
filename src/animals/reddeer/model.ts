import type { Vec3 } from '../model.ts';
import type { AnimalModel } from '../model.ts';
import { antlerPart, deerModel, tine } from '../archetypes/deer.ts';

const BASE: Vec3 = [0.46, 0.035, 0.87];

export const model: AnimalModel = deerModel({
  antlers: antlerPart(BASE, 1.2, [
    tine(BASE, [0.4, 0.09, 1.02], [0.02, 0.014]),
    tine([0.4, 0.09, 1.02], [0.33, 0.12, 1.2], [0.014, 0.01]),
    tine([0.44, 0.05, 0.93], [0.52, 0.07, 1.0]),
    tine([0.41, 0.085, 1.03], [0.5, 0.11, 1.12]),
    tine([0.36, 0.105, 1.12], [0.42, 0.14, 1.23]),
    tine([0.33, 0.12, 1.2], [0.4, 0.15, 1.3], [0.01, 0.007]),
    tine([0.33, 0.12, 1.2], [0.28, 0.14, 1.31], [0.01, 0.007]),
  ]),
});
