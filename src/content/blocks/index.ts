import type { StationDef } from '../stations/definition.ts';
import { FLOOR } from './floor/index.ts';
import { WALL } from './wall/index.ts';

export const BLOCKS: readonly StationDef[] = [FLOOR, WALL];
