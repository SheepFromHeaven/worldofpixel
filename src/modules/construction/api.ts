import { capability } from '../../sim/kernel/kernel.ts';
import type { Structures } from './structures.ts';

export const STRUCTURES = capability<Structures>('structures');

export { available } from './build.ts';
export * from './structures.ts';
