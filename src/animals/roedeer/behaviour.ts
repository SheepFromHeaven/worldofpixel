import type { AnimalBehaviour } from '../types.ts';
import { compose, forager, herd, idler, sprinter, standsGround, withIdlePoses } from '../archetypes/behaviours.ts';
import { DEER_IDLES } from '../archetypes/deer.ts';
import { quadrupedPose } from '../archetypes/quadruped.ts';
import { Gait, Social } from '../../sim/mammals/vocabulary.ts';

const RUN_PACE = 2.2;

const RUN_FROM_METRES = 4;

export const behaviour: AnimalBehaviour = compose(
  sprinter({ runPace: RUN_PACE, runFromMetres: RUN_FROM_METRES }),
  forager({ runFromMetres: RUN_FROM_METRES, runPace: RUN_PACE }),
  standsGround({ distance: 0.6, pace: RUN_PACE }),
  idler([{ state: 'graze', weight: 5, seconds: [8, 25], needs: 'grass' }, { state: 'sniff', weight: 2, seconds: [3, 8] }]),
  { states: ['walk', 'run', 'graze', 'sniff'] },
  herd({ social: Social.Family, size: 3 }),
  { habits: { gait: Gait.Trot, sight: 0.9, day: 0.5, night: 0.5, dusk: 1, shy: 0.2, rest: 10, speed: 1.4, reach: 50, skit: 24 }, hooks: { pose: withIdlePoses(quadrupedPose(), DEER_IDLES) } },
);
