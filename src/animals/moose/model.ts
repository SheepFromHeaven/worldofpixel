import type { AnimalModel, Part } from '../model.ts';
import { flexFront, flexHead } from '../archetypes/quadruped.ts';
import { antlerPart, CHEST_DIP, deerModel, tine } from '../archetypes/deer.ts';

const embossed = (part: Part): Part => ({ ...part, emboss: 1.4 });

export const model: AnimalModel = deerModel({
  rise: 0.08,
  head: [0.62, 0, 0.66],
  headScale: 1.7,
  muzzle: [0.24, 0, -0.16],
  neck: [0.15, 0.1],
  neckMass: 0.5,
  bodyDepth: 0.19,
  ears: { dir: [-0.1, 0.9, 0.4], k: 1.3 },
  tail: { at: [-0.43, 0, 0.66], dir: [-0.6, 0, -0.5], k: 1, radii: [0.045, 0.03] },
  extra: [{ kind: 'BODY', blend: true, tilt: CHEST_DIP, shapes: [{ ellipsoid: flexFront([0.18, 0, 0.8]), radii: [0.2, 0.13, 0.12] }] }],
  antlers: embossed(antlerPart(
    [0.6, 0.05, 0.73],
    1.6,
    [
      tine([0.6, 0.05, 0.73], [0.59, 0.15, 0.84], [0.055, 0.045]),
      { ellipsoid: flexHead([0.59, 0.15, 0.84]), radii: [0.09, 0.075, 0.07] },
      { ellipsoid: flexHead([0.57, 0.21, 0.9]), radii: [0.12, 0.08, 0.075] },
      { ellipsoid: flexHead([0.55, 0.26, 0.95]), radii: [0.13, 0.08, 0.075] },
      { ellipsoid: flexHead([0.52, 0.31, 1.0]), radii: [0.11, 0.07, 0.07] },
      { ellipsoid: flexHead([0.66, 0.24, 0.93]), radii: [0.07, 0.065, 0.055] },
      tine([0.65, 0.25, 0.95], [0.69, 0.27, 1.07], [0.03, 0.022]),
      tine([0.58, 0.29, 1.0], [0.6, 0.32, 1.12], [0.03, 0.022]),
      tine([0.5, 0.32, 1.03], [0.5, 0.36, 1.15], [0.03, 0.022]),
      tine([0.43, 0.29, 1.0], [0.41, 0.33, 1.1], [0.03, 0.022]),
      tine([0.52, 0.34, 0.98], [0.52, 0.43, 1.03], [0.03, 0.022]),
    ],
    false,
    true,
  )),
});
