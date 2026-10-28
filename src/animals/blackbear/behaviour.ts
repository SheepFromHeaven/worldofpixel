import type { AnimalBehaviour } from '../types.ts';
import { climber, compose, forager, herd, sprinter, standsGround } from '../archetypes/behaviours.ts';
import { quadrupedPose } from '../archetypes/quadruped.ts';
import { Gait, Social } from '../../sim/mammals/vocabulary.ts';

const RUN_PACE = 2.4;

const RUN_FROM_METRES = 5;

export const behaviour: AnimalBehaviour = compose(
  sprinter({ runPace: RUN_PACE, runFromMetres: RUN_FROM_METRES }),
  forager({ runFromMetres: RUN_FROM_METRES, runPace: RUN_PACE }),
  standsGround({ distance: 0.6, pace: RUN_PACE }),
  herd({ social: Social.Family, size: 3 }),
  { states: ['walk', 'run', 'climb', 'leap'] },
  climber({ taste: 0.06, gap: [6, 18], perch: [8, 40], arboreal: 0.05 }),
  { habits: { gait: Gait.Walk, sight: 0.9, day: 0.6, night: 0.4, dusk: 0.7, shy: 0.2, rest: 22, speed: 0.9, reach: 40, skit: 16 }, hooks: { pose: quadrupedPose() } },
);
