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
  herd({ social: Social.Harem, size: 6 }),
  { habits: { gait: Gait.Walk, sight: 0.9, day: 1, night: 0, dusk: 0.1, rest: 8, speed: 1.8, reach: 24, skit: 10 }, hooks: { pose: quadrupedPose() } },
);
