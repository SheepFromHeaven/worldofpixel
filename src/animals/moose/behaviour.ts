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
  idler([{ state: 'graze', weight: 5, seconds: [8, 25], needs: 'grass' }, { state: 'sniff', weight: 2, seconds: [3, 8] }, { state: 'scratch', weight: 1, seconds: [8, 16], needs: 'tree' }]),
  { states: ['walk', 'run', 'graze', 'sniff', 'scratch'] },
  herd({ social: Social.Family, size: 2 }),
  { habits: { gait: Gait.Walk, sight: 1, day: 0.5, night: 0.5, dusk: 1, shy: 0.1, rest: 20, speed: 1.2, reach: 60, skit: 22 }, hooks: { pose: withIdlePoses(quadrupedPose(), DEER_IDLES) } },
);
