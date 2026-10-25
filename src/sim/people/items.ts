export const ItemType = {
  None: 0,
  Flint: 1,
  Stone: 2,
  DryKindling: 3,
  Branch: 4,
  HandAxe: 5,
  Torch: 6,
  BurningBranch: 7,
} as const;

export type ItemType = (typeof ItemType)[keyof typeof ItemType];

export const ITEM_NAMES: readonly string[] = ['nothing', 'flint', 'stone', 'dry kindling', 'branch', 'hand axe', 'torch', 'burning branch'];

export const ITEM_FUEL: readonly number[] = [0, 0, 0, 30, 100, 0, 60, 80];

export const STACK_STEP = 8;

export const STACK_STAGES = 5;

export const stackStage = (count: number): number => Math.min(STACK_STAGES - 1, Math.floor(count / STACK_STEP));
