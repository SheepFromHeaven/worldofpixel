import { BUILDABLES, needsOf } from '../../content/buildables.ts';
import { ItemType } from '../items/api.ts';

export const CAMPFIRE_BRANCHES = 3;

export const RELIGHT_FLINT = 2;

export const KINDLE_BRANCHES = 4;

export const PLAN_NEEDS: readonly (readonly (readonly [ItemType, number])[])[] = [
  [],
  [[ItemType.Branch, CAMPFIRE_BRANCHES]],
  [
    [ItemType.Flint, RELIGHT_FLINT],
    [ItemType.DryKindling, 1],
    [ItemType.Branch, 1],
  ],
  [[ItemType.Branch, KINDLE_BRANCHES]],
  ...BUILDABLES.map((def) => needsOf(def) as (readonly [ItemType, number])[]),
];
