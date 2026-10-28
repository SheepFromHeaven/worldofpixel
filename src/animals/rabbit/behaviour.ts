import type { AnimalBehaviour, Pose, PoseContext } from '../types.ts';
import { NO_POSE } from '../types.ts';
import { burrower, compose, forager, herd, idler, sprinter, withIdlePoses, withSink } from '../archetypes/behaviours.ts';
import { quadrupedPose } from '../archetypes/quadruped.ts';
import { Gait, Social } from '../../sim/mammals/vocabulary.ts';

const BOUND_PACE = 1.8;

const TAKEOFF = 0.42;

const SPRINT_METRES_PER_SECOND = 4.5 * BOUND_PACE;

const LEAP_METRES = 2.65;

const BODY_METRES = 0.4;

const GRAVITY = 9.81;

const SHOWN_HEIGHT = 1.5;

const SINK_SCALE = 0.55;

const LEAP_SECONDS = LEAP_METRES / SPRINT_METRES_PER_SECOND;

const AIR_SECONDS = (1 - TAKEOFF) * LEAP_SECONDS;

const APEX = (SHOWN_HEIGHT * GRAVITY * AIR_SECONDS ** 2) / 8 / BODY_METRES / SINK_SCALE;

const CYCLE: readonly (readonly [number, number, number])[] = [
  [0, 1, -1],
  [0.12, 0.6, -0.3],
  [0.32, -0.45, 1],
  [TAKEOFF, 1, -1],
  [0.7, 0.85, -0.85],
  [1, 1, -1],
];

const ease = (t: number): number => t * t * (3 - 2 * t);

const unit = (x: number): number => Math.max(0, Math.min(1, x));

const pulse = (since: number, from: number, to: number): number => ease(unit((since - from) / 0.2)) * (1 - ease(unit((since - to) / 0.2)));

const groomPose = ({ since, left }: PoseContext): Pose => {
  const up = Math.min(ease(unit(since / 1)), ease(unit(left / 0.9)));
  const wipe = up > 0.95 ? 0.28 * Math.sin(since * Math.PI * 2 * 4.5) * (pulse(since, 1.2, 2.3) + pulse(since, 2.7, 3.7)) : 0;
  const look = 0.6 * pulse(since, 4.3, 4.9) - 0.55 * pulse(since, 5.1, 5.6);
  return [wipe, look, up, 0];
};

const keyed = (u: number): readonly [number, number] => {
  const next = CYCLE.findIndex(([at]) => at >= u);
  const to = CYCLE[Math.max(1, next)]!;
  const from = CYCLE[Math.max(0, next - 1)]!;
  const t = ease((u - from[0]) / Math.max(1e-6, to[0] - from[0]));
  return [from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
};

const bound = (phase: number): Pose => {
  const u = (((phase / (Math.PI * 2)) % 1) + 1) % 1;
  const [spine, hind] = keyed(u);
  if (u < TAKEOFF) return [spine, hind, 0, 0];
  const t = (u - TAKEOFF) / (1 - TAKEOFF);
  return [spine, hind, 0, -APEX * 4 * t * (1 - t)];
};

const gallop = (pose: NonNullable<AnimalBehaviour['hooks']['pose']>): NonNullable<AnimalBehaviour['hooks']['pose']> => (context) => {
  if (context.state === 'bound') return context.going ? bound(context.phase) : NO_POSE;
  const base = pose(context);
  if (context.state === 'hop') return [0.6 * base[0], 0, base[2], base[3]];
  return base;
};

export const behaviour: AnimalBehaviour = compose(
  sprinter({ states: ['hop', 'bound'], runPace: BOUND_PACE, runFromPace: 1.3, runFromMetres: 3 }),
  forager({ turn: Math.PI, shortest: 0.2, longest: 0.6, runFromMetres: 3, runPace: BOUND_PACE }),
  burrower({ within: 8, pace: BOUND_PACE, hide: 6 }),
  herd({ social: Social.Colony, size: 4, groups: 2 }),
  idler([{ state: 'groom', weight: 1, seconds: [7, 9] }]),
  { states: ['hop', 'bound', 'burrow', 'groom'] },
  { habits: { gait: Gait.Hop, sight: 0.8, day: 0.5, night: 0.6, dusk: 1, shy: 0.4, rest: 4, speed: 4.5, reach: 18, skit: 12 }, hooks: { pose: withIdlePoses(gallop(withSink(quadrupedPose({ steady: 0.6, fast: ['hop', 'bound'] }), { coil: 0.9, kick: 0.8 })), { groom: groomPose }) } },
);
