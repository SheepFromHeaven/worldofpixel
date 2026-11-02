import type { Fauna, FaunaWeather } from './fauna.ts';
import { capability } from '../../sim/kernel/kernel.ts';

export const FAUNA = capability<Fauna>('fauna');
export const FAUNA_GROUPS = capability<ReadonlySet<string>>('faunaGroups');
export const FAUNA_CLIMATE = capability<FaunaWeather>('faunaClimate');
export * from './fauna.ts';
export * from './life.ts';
export * from './patches.ts';
export * from './habitat/suitability.ts';
export * from './pack.ts';
export { buildDiet, flowSlot } from './diet.ts';
