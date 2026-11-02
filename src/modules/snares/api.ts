import type { Snares } from './snares.ts';
import { capability } from '../../sim/kernel/kernel.ts';

export const SNARES = capability<Snares>('snares');
