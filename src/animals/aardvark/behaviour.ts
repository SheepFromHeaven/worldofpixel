import type { AnimalBehaviour, Pose, PoseContext } from '../types.ts';
import { burrower, compose, dwells, ease, forager, idler, sprinter, withIdlePoses, withSink } from '../archetypes/behaviours.ts';
import { quadrupedPose } from '../archetypes/quadruped.ts';
import { HomeKind } from '../../sim/homes/homes.ts';
import { Gait } from '../../sim/mammals/vocabulary.ts';

const BURROW_PACE = 3;

const DIG_HERTZ = 1.6;

const digPose = ({ since, left }: PoseContext): Pose => [since * DIG_HERTZ * Math.PI * 2, ease(since / 1.2) * ease(left / 1), 0, 0];

export const behaviour: AnimalBehaviour = compose(
  sprinter({ runPace: BURROW_PACE }),
  forager({ turn: 0.6, shortest: 0.6, longest: 1 }),
  burrower({ within: 6, pace: BURROW_PACE }),
  dwells({ kind: HomeKind.Burrow, days: 1.5 }),
  idler([{ state: 'dig', weight: 1, seconds: [8, 20] }]),
  { states: ['walk', 'run', 'burrow', 'dig'] },
  { habits: { gait: Gait.Walk, sight: 0.5, day: 0, night: 1, dusk: 0.4, shy: 0.4, rest: 22, speed: 0.7, reach: 40, skit: 12 }, hooks: { pose: withIdlePoses(withSink(quadrupedPose()), { dig: digPose }) } },
);
