import { songbirdModel } from '../archetypes/songbird.ts';

export const model = songbirdModel({ body: [0.36, 0.15, 0.18], head: [0.12, 0.1, 0.11], bill: { length: 0.17, depth: 0.025 }, tail: { to: [-0.5, 0.34], radii: [0.055, 0.04] }, face: false });
