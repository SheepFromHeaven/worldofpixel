import { songbirdModel } from '../archetypes/songbird.ts';

export const model = songbirdModel({ body: [0.32, 0.18, 0.2], head: [0.14, 0.12, 0.13], bill: { length: 0.09, depth: 0.028 }, tail: { to: [-0.55, 0.35], radii: [0.055, 0.04] }, mark: { at: [0.12, 0, 0.3], radii: [0.3, 0.2, 0.16] } });
