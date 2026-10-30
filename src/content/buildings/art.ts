import type { Art } from '../art.ts';
import { art as storage } from './storage/art.ts';
import { art as knappingFloor } from './knappingFloor/art.ts';
import { art as bed } from './bed/art.ts';
import { art as snare } from './snare/art.ts';
import { art as hut } from './hut/art.ts';
import { art as tipi } from './tipi/art.ts';
import { art as campfire } from './campfire/art.ts';
import { art as torch } from './torch/art.ts';

export const BUILDING_ARTS: readonly Art[] = [storage, knappingFloor, bed, snare, hut, tipi, campfire, torch];
