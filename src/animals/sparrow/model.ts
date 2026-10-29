import { songbirdModel } from '../archetypes/songbird.ts';

export const model = songbirdModel({ body: [0.34, 0.19, 0.22], head: [0.14, 0.12, 0.13], bill: { length: 0.1, depth: 0.035 }, tail: { to: [-0.5, 0.34], radii: [0.065, 0.05] }, leg: 0.22, mark: { at: [0.34, 0, 0.5], radii: [0.1, 0.1, 0.08] } });
