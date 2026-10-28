import type { AnimalBehaviour } from '../types.ts';
import { compose, forager, herd, sprinter, standsGround } from '../archetypes/behaviours.ts';
import { quadrupedPose } from '../archetypes/quadruped.ts';
import { Gait, Social } from '../../sim/mammals/vocabulary.ts';

const RUN_PACE = 2.2;

const RUN_FROM_METRES = 4;

export const behaviour: AnimalBehaviour = compose(
  sprinter({ runPace: RUN_PACE, runFromMetres: RUN_FROM_METRES }),
  forager({ runFromMetres: RUN_FROM_METRES, runPace: RUN_PACE }),
  standsGround({ distance: 0.6, pace: RUN_PACE }),
  herd({ social: Social.Herd, size: 10 }),
  { habits: { gait: Gait.Trot, sight: 1, day: 0.7, night: 0.6, dusk: 0.5, shy: 0.05, rest: 12, speed: 1.4, reach: 90, skit: 24 }, hooks: { pose: quadrupedPose() } },
);
