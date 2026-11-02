import type { Animals } from './animals/animals.ts';
import { capability } from '../../sim/kernel/kernel.ts';

export const ANIMALS = capability<Animals>('animals');
export * from './species.ts';
export { Forest, indexOfRef, tileOfRef } from './climb/forest.ts';
export { buildTree, capacityOf, radiusFor } from './climb/tree.ts';
export type { TreeGraph } from './climb/tree.ts';
export * from './habitat.ts';
