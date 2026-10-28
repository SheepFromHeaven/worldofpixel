import type { AnimalBehaviour } from '../types.ts';
import { burrower, compose, forager, sprinter, withSink } from '../archetypes/behaviours.ts';
import { quadrupedPose } from '../archetypes/quadruped.ts';
import { Gait } from '../../sim/mammals/vocabulary.ts';

const BURROW_PACE = 3;

export const behaviour: AnimalBehaviour = compose(
  sprinter({ runPace: BURROW_PACE }),
  forager({ turn: 0.6, shortest: 0.6, longest: 1 }),
  burrower({ within: 6, pace: BURROW_PACE }),
  { states: ['walk', 'run', 'burrow'] },
  { habits: { gait: Gait.Walk, sight: 0.5, day: 0, night: 1, dusk: 0.4, shy: 0.4, rest: 22, speed: 0.7, reach: 40, skit: 12 }, hooks: { pose: withSink(quadrupedPose()) } },
);
