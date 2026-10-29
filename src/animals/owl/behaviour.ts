import { songbirdBehaviour } from '../archetypes/songbird.ts';
import { Gait } from '../../sim/birds/species.ts';

export const behaviour = songbirdBehaviour({ gait: Gait.Perch, day: 0.05, night: 1, dusk: 0.6, shy: 0.1, rest: 22, speed: 6, reach: 18, skit: 6, beat: 4, altitude: 4, migrant: 0, sing: 0.3, look: 0.8, glide: 0.7, flapEvery: 2.8, flapShare: 0.2 }, 0.95);
