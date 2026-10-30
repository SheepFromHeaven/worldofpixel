import { BED } from './bed/index.ts';
import { CAMPFIRE } from './campfire/index.ts';
import type { StationDef } from './definition.ts';
import { KNAPPING_FLOOR } from './knappingFloor/index.ts';
import { SNARE } from './snare/index.ts';
import { STORAGE } from './storage/index.ts';
import { TORCH } from './torch/index.ts';

export const STATIONS: readonly StationDef[] = [BED, SNARE, STORAGE, KNAPPING_FLOOR, CAMPFIRE, TORCH];

export const stationOf = (id: number): StationDef | undefined => STATIONS[id - 1];

export const stationIdOf = (key: string): number => {
  const at = STATIONS.findIndex((def) => def.key === key);
  if (at < 0) throw new Error(`no station called ${key}`);
  return at + 1;
};
