import { songbirdModel } from '../archetypes/songbird.ts';

export const model = songbirdModel({
  body: [0.3, 0.22, 0.3],
  head: [0.2, 0.2, 0.18],
  bill: { length: 0.05, depth: 0.035 },
  tail: { to: [-0.42, 0.26], radii: [0.09, 0.07] },
  wing: -0.5,
  wingRadii: [0.15, 0.09],
  leg: 0.2,
  faceRadii: [0.14, 0.16, 0.14],
  level: 0.75,
  eyes: { at: [0.47, 0.1, 0.64], radii: [0.08, 0.065, 0.08] },
});
