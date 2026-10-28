import type { Vec2 } from '../sim/geometry.ts';
import type { Draft } from '../sim/mammals/vocabulary.ts';

export interface FleeContext {
  here: Vec2;
  from: Vec2;
  den: Vec2;
  skit: number;
  random(): number;
}

export interface Flee {
  target: Vec2 | null;
  distance: number;
  pace: number;
  hide?: number;
}

export interface WanderContext {
  heading: number;
  longest: number;
  random(): number;
}

export interface Wander {
  turn: number;
  distance: number;
  pace?: number;
}

export interface StateContext {
  going: boolean;
  pace: number;
}

export interface PoseContext {
  state: string;
  phase: number;
  going: boolean;
  since: number;
  left: number;
}

export type Pose = readonly [number, number, number, number];

export interface CommandContext {
  distance: number;
}

export interface Hooks {
  flee?(context: FleeContext): Flee | null;
  wander?(context: WanderContext): Wander | null;
  state?(context: StateContext): string;
  command?(context: CommandContext): number;
  pose?(context: PoseContext): Pose;
}

export type Habits = Pick<Draft, 'gait' | 'social' | 'size' | 'groups' | 'sight' | 'day' | 'night' | 'dusk' | 'shy' | 'rest' | 'speed' | 'reach' | 'skit'>;

export type Config = Pick<Draft, 'key' | 'name' | 'form' | 'realm' | 'length' | 'height' | 'likes' | 'wet' | 'bias' | 'rough' | 'soil' | 'temperature' | 'season' | 'traits' | 'horn' | 'hornSize' | 'bulk' | 'neck' | 'head' | 'legs' | 'tail' | 'ears' | 'rut' | 'dive'>;

export type Texture = Pick<Draft, 'pattern' | 'colour' | 'accent' | 'eye' | 'spots'>;

const DEFAULT_STATES: readonly string[] = ['walk'];

export interface AnimalBehaviour {
  habits: Habits;
  hooks: Hooks;
  states?: readonly string[];
  paces?: Readonly<Record<string, number>>;
}

export interface AnimalRecord {
  config: Config;
  texture: Texture;
  behaviour: AnimalBehaviour;
}

export const statesOf = (behaviour: AnimalBehaviour | undefined): readonly string[] => behaviour?.states ?? DEFAULT_STATES;

export const paceOf = (behaviour: AnimalBehaviour | undefined, state: string): number => behaviour?.paces?.[state] ?? 1;

export const NO_POSE: Pose = [0, 0, 0, 0];

export const stateIndexOf = (behaviour: AnimalBehaviour | undefined, context: StateContext): number => {
  const name = behaviour?.hooks.state?.(context);
  const index = name === undefined ? 0 : statesOf(behaviour).indexOf(name);
  return index < 0 ? 0 : index;
};

export const draftOf = ({ config, texture, behaviour }: AnimalRecord): Draft => ({ ...config, ...texture, ...behaviour.habits }) as Draft;
