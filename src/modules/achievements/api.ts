import type { Achievements } from './achievements.ts';
import { capability } from '../../sim/kernel/kernel.ts';

export const EARNED = capability<Achievements>('achievements');
export * from './achievements.ts';
