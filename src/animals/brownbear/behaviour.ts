import type { AnimalBehaviour } from '../types.ts';
import { compose, ease, forager, herd, idler, sprinter, standsGround, withClimbPose, withIdlePoses } from '../archetypes/behaviours.ts';
import { quadrupedPose } from '../archetypes/quadruped.ts';
import { Gait, Social } from '../../sim/mammals/vocabulary.ts';

const RUN_PACE = 2.4;

const RUN_FROM_METRES = 5;

export const behaviour: AnimalBehaviour = compose(
  sprinter({ runPace: RUN_PACE, runFromMetres: RUN_FROM_METRES }),
  forager({ runFromMetres: RUN_FROM_METRES, runPace: RUN_PACE }),
  standsGround({ distance: 0.6, pace: RUN_PACE }),
  idler([{ state: 'stand', weight: 1, seconds: [5, 14] }]),
  { states: ['walk', 'run', 'stand'] },
  herd({ social: Social.Family, size: 3 }),
  { habits: { gait: Gait.Walk, sight: 1, day: 0.6, night: 0.5, dusk: 0.7, shy: 0.1, rest: 22, speed: 0.9, reach: 50, skit: 18 }, hooks: { pose: withIdlePoses(withClimbPose(quadrupedPose()), { stand: ({ since, left }) => [0, 0, 0.85 * ease(since / 1.1) * ease(left / 1.1), 0] }) } },
);
