import { songbirdBehaviour } from '../archetypes/songbird.ts';
import { Gait } from '../../sim/birds/species.ts';

export const behaviour = songbirdBehaviour({ gait: Gait.Perch, day: 1, night: 0, dusk: 0.4, shy: 0.5, rest: 9, speed: 7, reach: 8, skit: 3, beat: 14, altitude: 1.2, migrant: 0, sing: 0.6 });
