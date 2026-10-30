import type { Animals } from './animals/animals.ts';
import { capability } from '../../sim/kernel/kernel.ts';

export const ANIMALS = capability<Animals>('animals');
export * from './species.ts';
