import type { Fish, FishEnvironment } from './fish.ts';
import { capability } from '../../sim/kernel/kernel.ts';

export const FISH_SIM = capability<Fish>('fish');
export const WATERS = capability<FishEnvironment>('waters');
export * from './species.ts';
export * from './shoals.ts';
export { ECO_DAYS, Fish } from './fish.ts';
