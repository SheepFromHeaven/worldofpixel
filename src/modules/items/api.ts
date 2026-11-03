import type { GroundItems } from './groundItems.ts';
import { capability } from '../../sim/kernel/kernel.ts';

export const ITEMS = capability<GroundItems>('items');
export * from './items.ts';
export * from './groundItems.ts';
export * from './forage.ts';
