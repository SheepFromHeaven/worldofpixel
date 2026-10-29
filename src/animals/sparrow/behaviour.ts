import { songbirdBehaviour } from '../archetypes/songbird.ts';
import { Gait } from '../../sim/birds/species.ts';

export const behaviour = songbirdBehaviour({ gait: Gait.Perch, day: 1, night: 0, dusk: 0.2, shy: 0.5, rest: 7, speed: 8, reach: 10, skit: 4, beat: 14, altitude: 1.5, migrant: 0, sing: 0.5 });
