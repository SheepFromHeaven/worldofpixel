import { capability } from '../../sim/kernel/kernel.ts';
import type { Trails } from './trails.ts';

export const TRAILS = capability<Trails>('trails');
export * from './trails.ts';
