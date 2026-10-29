import type { AnimalBehaviour, Pose, PoseContext } from '../types.ts';
import { climber, compose, forager, sprinter, standsGround, withClimbPose } from '../archetypes/behaviours.ts';
import { withBounding } from '../archetypes/hopper.ts';
import type { Bounding } from '../archetypes/hopper.ts';
import { quadrupedPose } from '../archetypes/quadruped.ts';
import { Gait } from '../../sim/mammals/vocabulary.ts';

const BOUND_PACE = 1.8;

const BOUNDING: Bounding = { pace: BOUND_PACE, speed: 3.5, leap: 0.75, body: 0.22, shown: 1.5, sink: 0.55 };

const CLIMBING: readonly string[] = ['climb', 'rear', 'perch'];

const onTrunk = withClimbPose(quadrupedPose(), { rear: [0.9, 0], perch: [0.75, 0] });

const bounding = withBounding(quadrupedPose({ steady: 0.6, fast: ['hop', 'bound'] }), BOUNDING);

const pose = (context: PoseContext): Pose => (CLIMBING.includes(context.state) ? onTrunk(context) : bounding(context));

export const behaviour: AnimalBehaviour = compose(
  sprinter({ states: ['hop', 'bound'], runPace: BOUND_PACE, runFromPace: 1.3, runFromMetres: 2 }),
  forager({ turn: Math.PI, shortest: 0.2, longest: 0.7, runFromMetres: 2, runPace: BOUND_PACE }),
  standsGround({ distance: 0.5, pace: BOUND_PACE }),
  { states: ['hop', 'bound', 'climb', 'leap', 'rear', 'perch'] },
  climber({}),
  { habits: { gait: Gait.Bound, sight: 0.4, day: 1, night: 0, dusk: 0.3, shy: 0.5, rest: 3, speed: 3.5, reach: 14, skit: 5 }, hooks: { pose } },
);
