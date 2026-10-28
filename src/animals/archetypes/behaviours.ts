import type { ClimbHabits } from '../../sim/climb/ability.ts';
import type { AnimalBehaviour, FleeContext, Flee, Habits, Hooks, Pose, PoseContext, WanderContext, Wander } from '../types.ts';

export interface BehaviourPart {
  habits?: Partial<Habits>;
  hooks?: Hooks;
  states?: readonly string[];
  paces?: Readonly<Record<string, number>>;
  climb?: Partial<ClimbHabits>;
}

export const climber = (climb: Partial<ClimbHabits>): BehaviourPart => ({ climb });

export const compose = (...parts: readonly BehaviourPart[]): AnimalBehaviour => {
  const habits: Partial<Habits> = {};
  const hooks: Hooks = {};
  let states: readonly string[] | undefined;
  let paces: Record<string, number> | undefined;
  let climb: Partial<ClimbHabits> | undefined;
  for (const part of parts) {
    Object.assign(habits, part.habits);
    Object.assign(hooks, part.hooks);
    if (part.states) states = part.states;
    if (part.paces) paces = { ...paces, ...part.paces };
    if (part.climb) climb = { ...climb, ...part.climb };
  }
  return { habits: habits as Habits, hooks, ...(states ? { states } : {}), ...(paces ? { paces } : {}), ...(climb ? { climb } : {}) };
};

export interface Sprinter {
  states?: readonly [string, string];
  runPace?: number;
  runFromPace?: number;
  runFromMetres?: number;
}

export const sprinter = ({ states = ['walk', 'run'], runPace = 2.2, runFromPace = 1.5, runFromMetres = 4 }: Sprinter = {}): BehaviourPart => ({
  states,
  paces: { [states[0]]: 1, [states[1]]: runPace },
  hooks: {
    state: ({ pace }) => (pace >= runFromPace ? states[1] : states[0]),
    command: ({ distance }) => (distance >= runFromMetres ? runPace : 1),
  },
});

export interface Forager {
  turn?: number;
  shortest?: number;
  longest?: number;
  runFromMetres?: number;
  runPace?: number;
}

export const forager = ({ turn = Math.PI, shortest = 0.3, longest = 0.7, runFromMetres = Infinity, runPace = 1 }: Forager = {}): BehaviourPart => ({
  hooks: {
    wander: ({ longest: reach, random }: WanderContext): Wander => {
      const distance = reach * (shortest + (longest - shortest) * random());
      return { turn: (random() * 2 - 1) * turn, distance, pace: distance >= runFromMetres ? runPace : 1 };
    },
  },
});

export interface StandsGround {
  distance?: number;
  pace?: number;
}

export const standsGround = ({ distance = 0.6, pace = 1.6 }: StandsGround = {}): BehaviourPart => ({
  hooks: { flee: ({ skit }: FleeContext): Flee => ({ target: null, distance: skit * distance, pace }) },
});

export interface Burrower {
  within?: number;
  pace?: number;
  hide?: number;
}

export const burrower = ({ within = 6, pace = 3, hide = 6 }: Burrower = {}): BehaviourPart => ({
  hooks: {
    flee: ({ here, den, skit }: FleeContext): Flee | null => (Math.hypot(den.x - here.x, den.y - here.y) < skit * within ? { target: den, distance: skit, pace, hide } : null),
  },
});

export const herd = (habits: Pick<Habits, 'social' | 'size' | 'groups'>): BehaviourPart => ({ habits });

export interface Sinks {
  dig?: number;
  emerge?: number;
  coil?: number;
  kick?: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const withSink = (pose: (context: PoseContext) => Pose, { dig = 0.9, emerge = 0.9, coil = 2.8, kick = 0 }: Sinks = {}) => (context: PoseContext): Pose => {
  const base = pose(context);
  if (context.state !== 'burrow') return base;
  const entering = context.since < dig;
  if (entering) {
    const u = clamp01(context.since / dig);
    const duck = Math.sin(clamp01(u / 0.45) * Math.PI * 0.5);
    return [coil * duck, kick * duck, u * u, clamp01((u - 0.25) / 0.75) ** 1.6];
  }
  const u = clamp01(1 - context.left / emerge);
  if (context.left >= emerge) return [coil, kick, 1, 1];
  const rise = 1 - u;
  return [(-coil / 2) * rise * Math.sin(u * Math.PI), 0, 0.5 * rise, rise ** 1.8];
};

export interface ClimbPoses {
  climb?: readonly [number, number];
  rear?: readonly [number, number];
  perch?: readonly [number, number];
}

export const withClimbPose = (pose: (context: PoseContext) => Pose, { rear = [0.85, 0], perch = [0.7, 1] }: ClimbPoses = {}) => (context: PoseContext): Pose => {
  const base = pose(context);
  if (context.state === 'climb') {
    const upright = Math.min(1, context.pitch / (Math.PI / 2));
    return [base[0], 0.8 * upright, upright, 0];
  }
  if (context.state === 'rear') return [0, rear[1], rear[0], 0];
  if (context.state === 'perch') return [0, perch[1], perch[0], 0];
  return [base[0], 0, 0, 0];
};
