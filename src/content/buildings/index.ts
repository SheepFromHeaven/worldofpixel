import { itemIdOf } from '../items/index.ts';
import { hasResearch } from '../research/index.ts';
import { BED } from './bed/index.ts';
import { CAMPFIRE } from './campfire/index.ts';
import type { BuildingDef } from './definition.ts';
import { HUT } from './hut/index.ts';
import { KNAPPING_FLOOR } from './knappingFloor/index.ts';
import { SNARE } from './snare/index.ts';
import { STORAGE } from './storage/index.ts';
import { TIPI } from './tipi/index.ts';
import { TORCH } from './torch/index.ts';

export const BUILDINGS: readonly BuildingDef[] = [BED, HUT, SNARE, TIPI, STORAGE, KNAPPING_FLOOR, CAMPFIRE, TORCH];

export const PLAN_BASE = 3;

export const buildingOf = (id: number): BuildingDef | undefined => BUILDINGS[id - 1];

export const buildingIdOf = (key: string): number => {
  const at = BUILDINGS.findIndex((def) => def.key === key);
  if (at < 0) throw new Error(`no building called ${key}`);
  return at + 1;
};

export const planOf = (id: number): number => PLAN_BASE + id;

export const isBuildPlan = (plan: number): boolean => plan > PLAN_BASE;

export const buildingOfPlan = (plan: number): BuildingDef | undefined => (isBuildPlan(plan) ? BUILDINGS[plan - PLAN_BASE - 1] : undefined);

export const needsOf = (def: BuildingDef): (readonly [number, number])[] => def.needs.map(([key, count]) => [itemIdOf(key), count] as const);

export type { BuildingDef };

for (const def of BUILDINGS) if (def.unlock !== null && !hasResearch(def.unlock)) throw new Error(`${def.key} is unlocked by research ${def.unlock}, which does not exist`);
