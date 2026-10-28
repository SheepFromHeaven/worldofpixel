import type { AnimalBehaviour, Pose, PoseContext } from '../types.ts';
import { compose, ease, forager, herd, idler, sprinter, standsGround, withClimbPose, withIdlePoses } from '../archetypes/behaviours.ts';
import { quadrupedPose } from '../archetypes/quadruped.ts';
import { Gait, Social } from '../../sim/mammals/vocabulary.ts';

const RUN_PACE = 2.4;

const RUN_FROM_METRES = 5;

type Knots = readonly (readonly [number, number])[];

const along = (knots: Knots, x: number, shape: (t: number) => number): number => {
  const first = knots[0]!;
  if (x <= first[0]) return first[1];
  for (let at = 1; at < knots.length; at += 1) {
    const [x1, y1] = knots[at]!;
    const [x0, y0] = knots[at - 1]!;
    if (x <= x1) return y0 + (y1 - y0) * shape((x - x0) / (x1 - x0));
  }
  return knots[knots.length - 1]![1];
};

const HEAVY = (t: number): number => t * t * (3 - 2 * t);

const SETTLE_SECONDS = 2.9;

const sitPose = ({ since, left }: PoseContext): Pose => {
  const hind = Math.min(along([[0, 0], [0.3, 0], [1.8, 1]], since, (t) => t * t), along([[0, 0], [0.9, 0], [2.4, 1]], left, HEAVY));
  const settle = since > SETTLE_SECONDS ? 0.03 * Math.exp(-(since - SETTLE_SECONDS) * 5) * Math.sin((since - SETTLE_SECONDS) * 14) : 0;
  const body = Math.min(along([[0, 0], [1.3, 0], [SETTLE_SECONDS, 0.8]], since, HEAVY), along([[0, 0], [0.9, 0.2], [2.4, 0.3], [3.2, 0.8]], left, HEAVY)) + settle;
  const chew = ease((since - 3) / 0.5) * ease((left - 3.2) / 0.5) * 0.03 * Math.sin(since * 7);
  return [0, hind, body + chew, 0];
};

export const behaviour: AnimalBehaviour = compose(
  sprinter({ runPace: RUN_PACE, runFromMetres: RUN_FROM_METRES }),
  forager({ runFromMetres: RUN_FROM_METRES, runPace: RUN_PACE }),
  standsGround({ distance: 0.6, pace: RUN_PACE }),
  idler([{ state: 'eat', weight: 1, seconds: [10, 24] }]),
  { states: ['walk', 'run', 'eat'] },
  herd({ social: Social.Family, size: 2 }),
  { habits: { gait: Gait.Walk, sight: 0.9, day: 0.6, night: 0.5, dusk: 0.5, shy: 0.3, rest: 24, speed: 0.5, reach: 24, skit: 12 }, hooks: { pose: withIdlePoses(withClimbPose(quadrupedPose()), { eat: sitPose }) } },
);
