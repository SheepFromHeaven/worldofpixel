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
  idler([{ state: 'eat', weight: 1, seconds: [10, 24] }]),
  { states: ['walk', 'run', 'eat'] },
  herd({ social: Social.Family, size: 2 }),
  { habits: { gait: Gait.Walk, sight: 0.9, day: 0.6, night: 0.5, dusk: 0.5, shy: 0.3, rest: 24, speed: 0.5, reach: 24, skit: 12 }, hooks: { pose: withIdlePoses(withClimbPose(quadrupedPose()), { eat: ({ since, left }) => { const sit = ease(since / 1.4) * ease(left / 1.4); return [0, 1.0 * sit, 0.8 * sit + 0.03 * sit * Math.sin(since * 7), 0]; } }) } },
);
