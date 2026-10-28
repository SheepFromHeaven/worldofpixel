import type { AnimalBehaviour } from '../types.ts';
import { compose, forager, herd, sprinter, standsGround } from '../archetypes/behaviours.ts';
import { quadrupedPose } from '../archetypes/quadruped.ts';
import { Gait, Social } from '../../sim/mammals/vocabulary.ts';

const RUN_PACE = 2.4;

const RUN_FROM_METRES = 5;

export const behaviour: AnimalBehaviour = compose(
  sprinter({ runPace: RUN_PACE, runFromMetres: RUN_FROM_METRES }),
  forager({ runFromMetres: RUN_FROM_METRES, runPace: RUN_PACE }),
  standsGround({ distance: 0.6, pace: RUN_PACE }),
  herd({ social: Social.Family, size: 2 }),
  { habits: { gait: Gait.Walk, sight: 0.9, day: 0.6, night: 0.5, dusk: 0.5, shy: 0.3, rest: 24, speed: 0.5, reach: 24, skit: 12 }, hooks: { pose: quadrupedPose() } },
);
