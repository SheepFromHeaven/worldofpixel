import type { AnimalBehaviour, Pose, PoseContext } from '../types.ts';
import { climber, compose, ease, forager, idler, sprinter, standsGround, withClimbPose, withIdlePoses } from '../archetypes/behaviours.ts';
import { withBounding } from '../archetypes/hopper.ts';
import type { Bounding } from '../archetypes/hopper.ts';
import { quadrupedPose } from '../archetypes/quadruped.ts';
import { Gait } from '../../sim/mammals/vocabulary.ts';

const BOUND_PACE = 1.8;

const BOUNDING: Bounding = { pace: 1.3, speed: 3.5, leap: 0.7, body: 0.22, shown: 5, sink: 0.55 };

const CLIMBING: readonly string[] = ['climb', 'rear', 'perch'];

const onTrunk = withClimbPose(quadrupedPose(), { rear: [0.9, 0], perch: [0.75, 0] });

const bounding = withBounding(quadrupedPose({ steady: 0.6, fast: ['hop', 'bound'] }), BOUNDING);

const travelling = (context: PoseContext): Pose => (CLIMBING.includes(context.state) ? onTrunk(context) : bounding(context));

const SIT_UP = 0.75;

const unit = (x: number): number => Math.max(0, Math.min(1, x));

const pulse = (since: number, from: number, to: number): number => ease((since - from) / 0.15) * (1 - ease((since - to) / 0.15));

const sitting = ({ since, left }: PoseContext): number => Math.min(ease(since / 0.9), ease(left / 0.8));

const eatPose = (context: PoseContext): Pose => {
  const up = sitting(context);
  const nibble = unit(Math.sin(context.since * 2.1) * 3 + 0.6);
  const bob = up * nibble * (0.2 + 0.5 * Math.abs(Math.sin(context.since * 13)));
  return [up, 0.1 * up + 0.4 * bob, SIT_UP * up, 0.25 * up * pulse(context.since, 2.2, 3.4) * Math.sin(context.since * 7)];
};

const washPose = (context: PoseContext): Pose => {
  const up = sitting(context);
  const rub = pulse(context.since, 1.1, 2.6) + pulse(context.since, 3.0, 4.4);
  return [up * (0.8 + 0.2 * Math.sin(context.since * 10) * rub), up * (0.1 + 0.25 * rub * Math.sin(context.since * 10 + 1.5)), SIT_UP * up, 0];
};

const flickPose = ({ since, left }: PoseContext): Pose => {
  const fade = ease(since / 0.2) * ease(left / 0.3);
  const burst = pulse(since, 0.3, 1.1) + pulse(since, 1.7, 2.3);
  return [0, 0, 0, 0.5 * fade * unit(burst) * Math.sin(since * 16)];
};

const pose = withIdlePoses(travelling, { eat: eatPose, wash: washPose, flick: flickPose });

export const behaviour: AnimalBehaviour = compose(
  sprinter({ states: ['hop', 'bound'], runPace: BOUND_PACE, runFromPace: 0, runFromMetres: 2 }),
  forager({ turn: Math.PI, shortest: 0.2, longest: 0.7, runFromMetres: 2, runPace: BOUND_PACE }),
  standsGround({ distance: 0.5, pace: BOUND_PACE }),
  idler([
    { state: 'eat', weight: 1, seconds: [5, 9] },
    { state: 'wash', weight: 0.8, seconds: [4.5, 6] },
    { state: 'flick', weight: 0.8, seconds: [2.5, 3.5] },
  ]),
  { states: ['hop', 'bound', 'climb', 'leap', 'rear', 'perch', 'eat', 'wash', 'flick'] },
  climber({}),
  { habits: { gait: Gait.Bound, sight: 0.4, day: 1, night: 0, dusk: 0.3, shy: 0.5, rest: 3, speed: 3.5, reach: 14, skit: 5 }, hooks: { pose } },
);
