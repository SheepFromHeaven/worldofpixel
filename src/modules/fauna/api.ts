import type { Fauna, FaunaWeather } from './fauna.ts';
import { capability } from '../../sim/kernel/kernel.ts';

export const FAUNA = capability<Fauna>('fauna');
export const FAUNA_GROUPS = capability<ReadonlySet<string>>('faunaGroups');
export const FAUNA_CLIMATE = capability<FaunaWeather>('faunaClimate');
export * from './fauna.ts';
export * from './life.ts';
export * from './patches.ts';
export * from './habitat/suitability.ts';
export * from './habitat/amphibianHabitat.ts';
export * from './habitat/birdHabitat.ts';
export * from './habitat/insectHabitat.ts';
export * from './habitat/mammalHabitat.ts';
export * from './habitat/reptileHabitat.ts';
export * from './pack.ts';
