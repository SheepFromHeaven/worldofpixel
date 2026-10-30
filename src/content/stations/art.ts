import type { Art } from '../art.ts';
import { art as storage } from './storage/art.ts';
import { art as knappingFloor } from './knappingFloor/art.ts';
import { art as bed } from './bed/art.ts';
import { art as snare } from './snare/art.ts';
import { art as campfire } from './campfire/art.ts';
import { art as torch } from './torch/art.ts';

export const STATION_ARTS: readonly Art[] = [storage, knappingFloor, bed, snare, campfire, torch];
