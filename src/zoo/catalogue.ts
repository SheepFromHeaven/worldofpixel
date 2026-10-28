import { behaviourOf } from '../animals/catalogue.ts';
import { config as humanConfig } from '../animals/human/config.ts';
import type { Wander, WanderContext } from '../animals/types.ts';
import type { ZooGroup } from '../render/lit/zoo.ts';
import { AMPHIBIANS } from '../sim/amphibians/species.ts';
import { BIRDS } from '../sim/birds/species.ts';
import { GROUP_BASE, LIFE_COUNT } from '../sim/fauna/life.ts';
import { INSECTS } from '../sim/insects/species.ts';
import { Gait, MAMMALS } from '../sim/mammals/species.ts';
import { turnRadiusOf } from '../sim/animals/walker.ts';
import { REPTILES } from '../sim/reptiles/species.ts';

export interface ZooEntry {
  group: ZooGroup;
  index: number;
  key: string;
  name: string;
  life: number;
  speed: number;
  reach: number;
  rest: number;
  roams: boolean;
  restless: boolean;
  radius: number;
  length: number;
  bound: boolean;
  wander?: (context: WanderContext) => Wander | null;
}

const DEFAULT_RADIUS = 0.3;

const INSECT_SPEED = 1.2;

const AMPHIBIAN_SPEED = 1;

const AMPHIBIAN_REACH = 8;

const INSECT_REACH = 6;

interface Habits {
  speed: number;
  reach: number;
  rest: number;
  roams: boolean;
  restless: boolean;
  radius: number;
  length: number;
}

const BOUND_GROUPS: readonly ZooGroup[] = ['mammal', 'reptile', 'amphibian', 'human'];

const entries = <T extends { key: string; name: string }>(group: ZooGroup, species: readonly T[], habitsOf: (one: T) => Habits): ZooEntry[] =>
  species.map((one, index) => ({ group, index, key: one.key, name: one.name, life: group === 'human' ? LIFE_COUNT + index : GROUP_BASE[group] + index, bound: BOUND_GROUPS.includes(group), ...habitsOf(one), ...((group === 'mammal' || group === 'human') && behaviourOf(one.key)?.hooks.wander ? { wander: behaviourOf(one.key)!.hooks.wander! } : {}) }));

export const GROUPS: readonly { group: ZooGroup; title: string }[] = [
  { group: 'mammal', title: 'mammals' },
  { group: 'bird', title: 'birds' },
  { group: 'reptile', title: 'reptiles' },
  { group: 'amphibian', title: 'amphibians' },
  { group: 'insect', title: 'insects' },
  { group: 'human', title: 'people' },
];

const ROAMING_GAITS: readonly number[] = [Gait.Walk, Gait.Trot, Gait.Hop, Gait.Bound, Gait.Swim, Gait.Cruise, Gait.Porpoise];

const CONTINUOUS_GAITS: readonly number[] = [Gait.Cruise, Gait.Porpoise];

export const ZOO: readonly ZooEntry[] = [
  ...entries('mammal', MAMMALS, (one) => ({ speed: one.speed, reach: one.reach, rest: one.rest, roams: ROAMING_GAITS.includes(one.gait), restless: CONTINUOUS_GAITS.includes(one.gait), radius: turnRadiusOf(one.length), length: one.length })),
  ...entries('bird', BIRDS, (one) => ({ speed: one.speed, reach: one.reach, rest: one.rest, roams: false, restless: false, radius: DEFAULT_RADIUS, length: 0 })),
  ...entries('reptile', REPTILES, (one) => ({ speed: one.speed, reach: one.reach, rest: one.rest, roams: true, restless: false, radius: DEFAULT_RADIUS, length: 0 })),
  ...entries('amphibian', AMPHIBIANS, (one) => ({ speed: AMPHIBIAN_SPEED, reach: AMPHIBIAN_REACH, rest: one.rest, roams: true, restless: false, radius: DEFAULT_RADIUS, length: 0 })),
  ...entries('human', [humanConfig], () => ({ speed: 1.3, reach: 20, rest: 4, roams: true, restless: false, radius: DEFAULT_RADIUS, length: humanConfig.length })),
  ...entries('insect', INSECTS, () => ({ speed: INSECT_SPEED, reach: INSECT_REACH, rest: 0, roams: false, restless: false, radius: DEFAULT_RADIUS, length: 0 })),
];
