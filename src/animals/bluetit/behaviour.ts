import { songbirdBehaviour } from '../archetypes/songbird.ts';
import { Gait } from '../../sim/birds/species.ts';

export const behaviour = songbirdBehaviour({ gait: Gait.Perch, day: 1, night: 0, dusk: 0.1, shy: 0.6, rest: 6, speed: 7, reach: 7, skit: 3, beat: 18, altitude: 2, migrant: 0, sing: 0.6 });
