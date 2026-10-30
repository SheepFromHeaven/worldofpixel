import type { Art } from '../art.ts';
import { art as floor } from './floor/art.ts';
import { art as wall } from './wall/art.ts';

export const BLOCK_ARTS: readonly Art[] = [floor, wall];
