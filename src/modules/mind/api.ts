import type { Mind } from './mind.ts';
import { capability } from '../../sim/kernel/kernel.ts';

export const MIND = capability<Mind>('mind');
export * from './mind.ts';
export * from './neurons.ts';
