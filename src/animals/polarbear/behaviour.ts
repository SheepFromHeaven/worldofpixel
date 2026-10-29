import type { AnimalBehaviour } from '../types.ts';
import { compose, forager, herd, sprinter, standsGround, withClimbPose } from '../archetypes/behaviours.ts';
import { quadrupedPose } from '../archetypes/quadruped.ts';
import { Gait, Social } from '../../sim/mammals/vocabulary.ts';

const RUN_PACE = 2.4;

const RUN_FROM_METRES = 5;

export const behaviour: AnimalBehaviour = compose(
  sprinter({ runPace: RUN_PACE, runFromMetres: RUN_FROM_METRES }),
  forager({ runFromMetres: RUN_FROM_METRES, runPace: RUN_PACE }),
  standsGround({ distance: 0.6, pace: RUN_PACE }),
  herd({ social: Social.Family, size: 2 }),
  { habits: { gait: Gait.Walk, sight: 1, day: 0.6, night: 0.6, dusk: 0.5, shy: 0.05, rest: 26, speed: 0.9, reach: 80, skit: 22 }, hooks: { pose: withClimbPose(quadrupedPose()) } },
);
