import type { ZooGroup } from '../render/lit/zoo.ts';
import { AMPHIBIANS } from '../sim/amphibians/species.ts';
import { BIRDS } from '../sim/birds/species.ts';
import { GROUP_BASE } from '../sim/fauna/life.ts';
import { INSECTS } from '../sim/insects/species.ts';
import { MAMMALS } from '../sim/mammals/species.ts';
import { REPTILES } from '../sim/reptiles/species.ts';

export interface ZooEntry {
  group: ZooGroup;
  index: number;
  key: string;
  name: string;
  life: number;
  speed: number;
}

const INSECT_SPEED = 1.2;

const AMPHIBIAN_SPEED = 1;

const entries = <T extends { key: string; name: string }>(group: ZooGroup, species: readonly T[], speedOf: (one: T) => number): ZooEntry[] =>
  species.map((one, index) => ({ group, index, key: one.key, name: one.name, life: GROUP_BASE[group] + index, speed: speedOf(one) }));

export const GROUPS: readonly { group: ZooGroup; title: string }[] = [
  { group: 'mammal', title: 'mammals' },
  { group: 'bird', title: 'birds' },
  { group: 'reptile', title: 'reptiles' },
  { group: 'amphibian', title: 'amphibians' },
  { group: 'insect', title: 'insects' },
];

export const ZOO: readonly ZooEntry[] = [
  ...entries('mammal', MAMMALS, (one) => one.speed),
  ...entries('bird', BIRDS, (one) => one.speed),
  ...entries('reptile', REPTILES, (one) => one.speed),
  ...entries('amphibian', AMPHIBIANS, () => AMPHIBIAN_SPEED),
  ...entries('insect', INSECTS, () => INSECT_SPEED),
];
