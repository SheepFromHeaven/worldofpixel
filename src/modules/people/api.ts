import type { People, PeopleEnvironment } from './people.ts';
import { capability } from '../../sim/kernel/kernel.ts';

export const PEOPLE = capability<People>('people');
export const SURROUNDINGS = capability<PeopleEnvironment>('surroundings');

export * from './people.ts';
export * from './activities.ts';
export * from './ids.ts';
export * from './bubbles.ts';
export { sideOf } from './fireside.ts';
