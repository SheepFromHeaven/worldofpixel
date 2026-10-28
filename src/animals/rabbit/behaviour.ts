import type { AnimalBehaviour } from '../types.ts';
import { burrower, compose, forager, herd, sprinter, withSink } from '../archetypes/behaviours.ts';
import { quadrupedPose } from '../archetypes/quadruped.ts';
import { Gait, Social } from '../../sim/mammals/vocabulary.ts';

const BOUND_PACE = 1.8;

export const behaviour: AnimalBehaviour = compose(
  sprinter({ states: ['hop', 'bound'], runPace: BOUND_PACE, runFromPace: 1.3, runFromMetres: 3 }),
  forager({ turn: Math.PI, shortest: 0.2, longest: 0.6, runFromMetres: 3, runPace: BOUND_PACE }),
  burrower({ within: 8, pace: BOUND_PACE, hide: 6 }),
  herd({ social: Social.Colony, size: 4, groups: 2 }),
  { states: ['hop', 'bound', 'burrow'] },
  { habits: { gait: Gait.Hop, sight: 0.8, day: 0.5, night: 0.6, dusk: 1, shy: 0.4, rest: 4, speed: 4.5, reach: 18, skit: 12 }, hooks: { pose: withSink(quadrupedPose({ steady: 0.6, fast: ['hop', 'bound'] })) } },
);
