import type { Range } from '../plants/species.ts';
import { Aqua } from '../aquatic.ts';

export const GLIDE = 0.45;

export type Water = 'fresh' | 'salt';

export interface Dart {
  readonly period: number;
  readonly chance: number;
  readonly lengths: number;
  readonly seconds: number;
}

export interface FishSpecies {
  readonly key: string;
  readonly name: string;
  readonly water: Water;
  readonly length: number;
  readonly mass: number;
  readonly school: number;
  readonly temperature: Range;
  readonly depth: Range;
  readonly flow: Range;
  readonly shore: Range;
  readonly cover: Readonly<Partial<Record<number, number>>>;
  readonly speed: number;
  readonly rate: number;
  readonly prey: readonly string[];
  readonly appetite: number;
  readonly common: number;
  readonly dart: Dart;
  readonly day: number;
  readonly night: number;
  readonly dusk: number;
}

interface Draft {
  key: string;
  name: string;
  water: Water;
  length: number;
  mass: number;
  school: number;
  temperature: Range;
  depth: Range;
  flow?: Range;
  shore?: Range;
  cover?: Partial<Record<number, number>>;
  speed: number;
  rate: number;
  prey?: string[];
  appetite?: number;
  common?: number;
  dart?: Dart;
  day?: number;
  night?: number;
  dusk?: number;
}

const ANY_SHORE: Range = [0, 0, 400, 800];

const STILL_WATER: Range = [0, 0, 0.5, 1];

const make = (draft: Draft): FishSpecies => ({
  key: draft.key,
  name: draft.name,
  water: draft.water,
  length: draft.length,
  mass: draft.mass,
  school: draft.school,
  temperature: draft.temperature,
  depth: draft.depth,
  flow: draft.flow ?? STILL_WATER,
  shore: draft.shore ?? ANY_SHORE,
  cover: draft.cover ?? {},
  speed: draft.speed,
  rate: draft.rate,
  prey: draft.prey ?? [],
  appetite: draft.appetite ?? 0.04,
  common: draft.common ?? 1,
  day: draft.day ?? 1,
  night: draft.night ?? 0.4,
  dusk: draft.dusk ?? 0,
  dart: draft.dart ?? { period: 6, chance: 0.4, lengths: 5, seconds: 0.4 },
});

export const FISH: readonly FishSpecies[] = [
  make({ key: 'minnow', day: 1, night: 0.2, dusk: 0.4, dart: { period: 3, chance: 0.5, lengths: 6, seconds: 0.35 }, name: 'minnow', water: 'fresh', length: 0.07, mass: 0.004, school: 40, temperature: [2, 8, 20, 26], depth: [0.2, 0.4, 1.5, 3], flow: [0, 0, 0.6, 1.1], cover: { [Aqua.Reeds]: 0.4, [Aqua.Weed]: 0.3, [Aqua.Algae]: 0.2 }, speed: 0.35, rate: 0.14 }),
  make({ key: 'perch', day: 1, night: 0.2, dusk: 0.5, dart: { period: 6, chance: 0.35, lengths: 5, seconds: 0.4 }, common: 0.5, name: 'perch', water: 'fresh', length: 0.25, mass: 0.3, school: 14, temperature: [4, 10, 22, 28], depth: [0.5, 1, 5, 12], flow: [0, 0, 0.4, 0.9], cover: { [Aqua.Reeds]: 0.3, [Aqua.Lily]: 0.2 }, speed: 0.5, rate: 0.07, prey: ['minnow'], appetite: 0.01 }),
  make({ key: 'carp', day: 0.7, night: 1, dusk: 0.6, dart: { period: 12, chance: 0.25, lengths: 4, seconds: 0.8 }, common: 0.4, name: 'carp', water: 'fresh', length: 0.5, mass: 2, school: 8, temperature: [8, 15, 26, 32], depth: [0.8, 1.5, 4, 10], flow: [0, 0, 0.3, 0.7], cover: { [Aqua.Lily]: 0.4, [Aqua.Algae]: 0.3, [Aqua.Reeds]: 0.3 }, speed: 0.4, rate: 0.05 }),
  make({ key: 'trout', day: 0.6, night: 0.7, dusk: 1, dart: { period: 8, chance: 0.5, lengths: 7, seconds: 0.3 }, common: 0.5, name: 'trout', water: 'fresh', length: 0.35, mass: 0.6, school: 6, temperature: [3, 6, 14, 19], depth: [0.3, 0.6, 2, 6], flow: [0.25, 0.6, 1.6, 2.4], cover: { [Aqua.Weed]: 0.3 }, speed: 0.7, rate: 0.04, prey: ['minnow'], appetite: 0.01 }),
  make({ key: 'pike', day: 0.5, night: 0.6, dusk: 1, dart: { period: 14, chance: 0.15, lengths: 10, seconds: 0.2 }, common: 0.05, name: 'pike', water: 'fresh', length: 0.7, mass: 3, school: 5, temperature: [4, 10, 22, 28], depth: [0.4, 0.8, 2.5, 6], flow: [0, 0, 0.4, 0.9], cover: { [Aqua.Reeds]: 0.6, [Aqua.Lily]: 0.3 }, speed: 0.8, rate: 0.03, prey: ['minnow', 'perch'], appetite: 0.01 }),
  make({ key: 'herring', day: 0.8, night: 1, dusk: 0.8, dart: { period: 4, chance: 0.5, lengths: 5, seconds: 0.3 }, name: 'herring', water: 'salt', length: 0.25, mass: 0.2, school: 60, temperature: [2, 6, 16, 22], depth: [1, 4, 18, 26], speed: 0.8, rate: 0.1 }),
  make({ key: 'mackerel', day: 1, night: 0.3, dusk: 0.5, dart: { period: 3, chance: 0.6, lengths: 7, seconds: 0.3 }, common: 0.5, name: 'mackerel', water: 'salt', length: 0.35, mass: 0.5, school: 30, temperature: [10, 14, 24, 28], depth: [1, 3, 18, 26], speed: 1.1, rate: 0.07, prey: ['herring'], appetite: 0.01 }),
  make({ key: 'flatfish', day: 0.3, night: 1, dusk: 0.8, dart: { period: 20, chance: 0.1, lengths: 2, seconds: 1.0 }, common: 0.4, name: 'flatfish', water: 'salt', length: 0.4, mass: 1, school: 4, temperature: [2, 8, 18, 24], depth: [0.3, 1, 12, 25], cover: { [Aqua.Seagrass]: 0.5 }, speed: 0.25, rate: 0.05 }),
  make({ key: 'cod', day: 0.5, night: 1, dusk: 0.9, dart: { period: 10, chance: 0.3, lengths: 4, seconds: 0.6 }, common: 0.12, name: 'cod', water: 'salt', length: 0.8, mass: 6, school: 6, temperature: [-1, 2, 10, 15], depth: [3, 8, 26, 26], cover: { [Aqua.Kelp]: 0.5 }, speed: 0.5, rate: 0.035, prey: ['herring'], appetite: 0.01 }),
  make({ key: 'tuna', day: 1, night: 0.4, dusk: 0.7, dart: { period: 6, chance: 0.4, lengths: 10, seconds: 0.5 }, common: 0.01, name: 'tuna', water: 'salt', length: 1.8, mass: 60, school: 4, temperature: [14, 18, 28, 32], depth: [4, 8, 26, 26], shore: [2, 8, 400, 800], speed: 2.2, rate: 0.03, prey: ['mackerel', 'herring'], appetite: 0.01 }),
];

export const MIN_ACTIVITY = 0.1;

export const activityOf = (species: FishSpecies, daylight: number): number =>
  Math.min(1, Math.max(MIN_ACTIVITY, species.night + (species.day - species.night) * daylight + species.dusk * 4 * daylight * (1 - daylight)));

export const FISH_COUNT = FISH.length;

export const fishOf = (id: number): FishSpecies | undefined => FISH[id - 1];

export const fishIdOf = (key: string): number => FISH.findIndex((fish) => fish.key === key) + 1;
