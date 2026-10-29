import type { Vec2 } from '../sim/geometry.ts';
import type { ClimbHabits } from '../sim/climb/ability.ts';
import type { BirdDraft } from '../sim/birds/species.ts';
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
  pitch: number;
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

export type Config = Pick<Draft, 'key' | 'name' | 'form' | 'realm' | 'length' | 'height' | 'likes' | 'wet' | 'bias' | 'rough' | 'soil' | 'temperature' | 'season' | 'traits' | 'horn' | 'hornSize' | 'hornBoth' | 'bulk' | 'neck' | 'head' | 'legs' | 'tail' | 'ears' | 'rut' | 'dive'>;

export type Texture = Pick<Draft, 'pattern' | 'colour' | 'accent' | 'eye' | 'spots'>;

const DEFAULT_STATES: readonly string[] = ['walk'];

export interface IdleHabit {
  state: string;
  weight: number;
  seconds: readonly [number, number];
  needs?: 'grass' | 'tree';
}

export type BirdHabits = Pick<BirdDraft, 'gait' | 'day' | 'night' | 'dusk' | 'shy' | 'rest' | 'speed' | 'reach' | 'skit' | 'beat' | 'altitude' | 'migrant' | 'sing' | 'look' | 'glide' | 'flapEvery' | 'flapShare'>;

export type BirdConfig = Pick<BirdDraft, 'key' | 'name' | 'realm' | 'length' | 'span' | 'adults' | 'common' | 'likes' | 'nest' | 'bias' | 'temperature' | 'season' | 'traits' | 'bulk' | 'tail'>;

export type FishHabits = { beat: number; still: number; tight: number };

export interface FishConfig {
  key: string;
  name: string;
  length: number;
}

export type BirdTexture = Pick<BirdDraft, 'pattern' | 'colour' | 'accent' | 'bill' | 'eye' | 'spots'>;

export interface HomeHabit {
  kind: number;
  days: number;
}

export interface AnimalBehaviour<H = Habits> {
  habits: H;
  hooks: Hooks;
  climb?: Partial<ClimbHabits>;
  idle?: readonly IdleHabit[];
  home?: HomeHabit;
  states?: readonly string[];
  paces?: Readonly<Record<string, number>>;
}

export type AnimalGroup = 'mammal' | 'amphibian' | 'people' | 'bird' | 'fish' | 'insect';

export interface DraftRecord {
  group: 'mammal' | 'amphibian' | 'people';
  config: Config;
  texture: Texture;
  behaviour: AnimalBehaviour;
}

export interface BirdRecord {
  group: 'bird';
  config: BirdConfig;
  texture: BirdTexture;
  behaviour: AnimalBehaviour<BirdHabits>;
}

export interface FishRecord {
  group: 'fish';
  config: FishConfig;
  behaviour: AnimalBehaviour<FishHabits>;
}

export interface InsectRecord {
  group: 'insect';
  config: { key: string; name: string };
}

export type AnimalRecord = DraftRecord | BirdRecord | FishRecord | InsectRecord;

export const statesOf = (behaviour: AnimalBehaviour<unknown> | undefined): readonly string[] => behaviour?.states ?? DEFAULT_STATES;

export const paceOf = (behaviour: AnimalBehaviour<unknown> | undefined, state: string): number => behaviour?.paces?.[state] ?? 1;

export const NO_POSE: Pose = [0, 0, 0, 0];

export const stateIndexOf = (behaviour: AnimalBehaviour<unknown> | undefined, context: StateContext): number => {
  const name = behaviour?.hooks.state?.(context);
  const index = name === undefined ? 0 : statesOf(behaviour).indexOf(name);
  return index < 0 ? 0 : index;
};

export const draftOf = ({ config, texture, behaviour }: DraftRecord): Draft => ({ ...config, ...texture, ...behaviour.habits }) as Draft;
