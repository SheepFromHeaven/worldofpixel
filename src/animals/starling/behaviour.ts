import { songbirdBehaviour } from '../archetypes/songbird.ts';
import { Gait } from '../../sim/birds/species.ts';

export const behaviour = songbirdBehaviour({ gait: Gait.Perch, day: 1, night: 0, dusk: 0.3, shy: 0.3, rest: 10, speed: 10, reach: 24, skit: 6, beat: 12, altitude: 3, migrant: 0.5, sing: 0.7 });
