import type { StationDef } from './stations/definition.ts';
import { BLOCKS } from './blocks/index.ts';
import { itemIdOf } from './items/index.ts';
import { hasResearch } from './research/index.ts';
import { STATIONS } from './stations/index.ts';

export const BUILDABLES: readonly StationDef[] = [...STATIONS, ...BLOCKS];

export const PLAN_BASE = 3;

export const buildableOf = (id: number): StationDef | undefined => BUILDABLES[id - 1];

export const buildableIdOf = (key: string): number => {
  const at = BUILDABLES.findIndex((def) => def.key === key);
  if (at < 0) throw new Error(`nothing buildable is called ${key}`);
  return at + 1;
};

export const planOf = (id: number): number => PLAN_BASE + id;

export const isBuildPlan = (plan: number): boolean => plan > PLAN_BASE;

export const buildableOfPlan = (plan: number): StationDef | undefined => (isBuildPlan(plan) ? BUILDABLES[plan - PLAN_BASE - 1] : undefined);

export const needsOf = (def: StationDef): (readonly [number, number])[] => def.needs.map(([key, count]) => [itemIdOf(key), count] as const);

for (const def of BUILDABLES) if (def.unlock !== null && !hasResearch(def.unlock)) throw new Error(`${def.key} is unlocked by research ${def.unlock}, which does not exist`);
