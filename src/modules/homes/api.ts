import type { Homes } from './homes.ts';
import { capability } from '../../sim/kernel/kernel.ts';

export const HOMES = capability<Homes>('homes');
export * from './homes.ts';
