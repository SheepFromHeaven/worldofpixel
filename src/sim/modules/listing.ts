import { behaviourOf } from '../../animals/catalogue.ts';
import { GROUP_BASE, LIFE_COUNT } from '../fauna/life.ts';
import type { Listing, ZooGroup } from './module.ts';

export interface Habits {
  speed: number;
  reach: number;
  rest: number;
  roams: boolean;
  restless: boolean;
  radius: number;
  length: number;
}

export const DEFAULT_RADIUS = 0.3;

const BOUND_GROUPS: readonly ZooGroup[] = ['mammal', 'reptile', 'amphibian', 'human'];

export const listingsOf = <T extends { key: string; name: string }>(group: ZooGroup, species: readonly T[], habitsOf: (one: T) => Habits): Listing[] =>
  species.map((one, index) => {
    const wander = group === 'mammal' || group === 'human' ? behaviourOf(one.key)?.hooks.wander : undefined;
    return {
      group,
      index,
      key: one.key,
      name: one.name,
      life: group === 'human' ? LIFE_COUNT + index : GROUP_BASE[group] + index,
      bound: BOUND_GROUPS.includes(group),
      ...habitsOf(one),
      ...(wander ? { wander } : {}),
    };
  });
