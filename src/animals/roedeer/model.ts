import type { AnimalModel } from '../model.ts';
import { antlerPart, deerModel, tine } from '../archetypes/deer.ts';

export const model: AnimalModel = deerModel({
  head: [0.47, 0, 0.75],
  headScale: 0.95,
  neck: [0.095, 0.058],
  neckMass: 0,
  bodyDepth: 0.17,
  ears: { dir: [-0.1, 0.85, 0.55], k: 1.5 },
  tail: { at: [-0.43, 0, 0.57], dir: [-0.6, 0, -0.4], k: 1, radii: [0.05, 0.03] },
  extra: [{ kind: 'TAIL', depth: 'self', shapes: [{ ellipsoid: [-0.42, 0, 0.56], radii: [0.045, 0.05, 0.07] }] }],
  antlers: antlerPart([0.43, 0.035, 0.83], 0.5, [
    tine([0.43, 0.035, 0.83], [0.41, 0.06, 0.96], [0.016, 0.011]),
    tine([0.41, 0.06, 0.96], [0.38, 0.075, 1.06], [0.012, 0.008]),
    tine([0.41, 0.06, 0.96], [0.47, 0.07, 1.02], [0.011, 0.007]),
  ]),
});
