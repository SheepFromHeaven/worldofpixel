import type { AnimalBehaviour, Pose, PoseContext } from '../types.ts';
import { burrower, compose, dwells, forager, herd, ease, idler, sprinter, withIdlePoses, withSink } from '../archetypes/behaviours.ts';
import { withBounding } from '../archetypes/hopper.ts';
import type { Bounding } from '../archetypes/hopper.ts';
import { quadrupedPose } from '../archetypes/quadruped.ts';
import { HomeKind } from '../../sim/homes/homes.ts';
import { Gait, Social } from '../../sim/mammals/vocabulary.ts';

const BOUND_PACE = 1.8;

const LEAP_METRES = 2.65;

const BODY_METRES = 0.4;

const SHOWN_HEIGHT = 1.5;

const SINK_SCALE = 0.55;

const BOUNDING: Bounding = { pace: BOUND_PACE, speed: 4.5, leap: LEAP_METRES, body: BODY_METRES, shown: SHOWN_HEIGHT, sink: SINK_SCALE };

const unit = (x: number): number => Math.max(0, Math.min(1, x));

const pulse = (since: number, from: number, to: number): number => ease(unit((since - from) / 0.2)) * (1 - ease(unit((since - to) / 0.2)));

const groomPose = ({ since, left }: PoseContext): Pose => {
  const up = Math.min(ease(unit(since / 1)), ease(unit(left / 0.9)));
  const wipe = up > 0.95 ? 0.28 * Math.sin(since * Math.PI * 2 * 4.5) * (pulse(since, 1.2, 2.3) + pulse(since, 2.7, 3.7)) : 0;
  const look = 0.6 * pulse(since, 4.3, 4.9) - 0.55 * pulse(since, 5.1, 5.6);
  return [wipe, look, up, 0];
};

export const behaviour: AnimalBehaviour = compose(
  sprinter({ states: ['hop', 'bound'], runPace: BOUND_PACE, runFromPace: 1.3, runFromMetres: 3 }),
  forager({ turn: Math.PI, shortest: 0.2, longest: 0.6, runFromMetres: 3, runPace: BOUND_PACE }),
  burrower({ within: 8, pace: BOUND_PACE, hide: 6 }),
  dwells({ kind: HomeKind.Burrow, days: 0.5 }),
  herd({ social: Social.Colony, size: 4, groups: 2 }),
  idler([{ state: 'groom', weight: 1, seconds: [7, 9] }]),
  { states: ['hop', 'bound', 'burrow', 'groom'] },
  { habits: { gait: Gait.Hop, sight: 0.8, day: 0.5, night: 0.6, dusk: 1, shy: 0.4, rest: 4, speed: 4.5, reach: 18, skit: 12 }, hooks: { pose: withIdlePoses(withBounding(withSink(quadrupedPose({ steady: 0.6, fast: ['hop', 'bound'] }), { coil: 0.9, kick: 0.8 }), BOUNDING), { groom: groomPose }) } },
);
