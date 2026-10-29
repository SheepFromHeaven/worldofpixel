export const ItemType = {
  None: 0,
  Flint: 1,
  Stone: 2,
  DryKindling: 3,
  Branch: 4,
  HandAxe: 5,
  Torch: 6,
  BurningBranch: 7,
  PlantFibre: 8,
  Berries: 9,
  Grubs: 10,
  Egg: 11,
  Cord: 12,
  Basket: 13,
  Roast: 14,
  Fish: 15,
  Rabbit: 16,
} as const;

export type ItemType = (typeof ItemType)[keyof typeof ItemType];

export const ITEM_NAMES: readonly string[] = ['nothing', 'flint', 'stone', 'dry kindling', 'branch', 'hand axe', 'torch', 'burning branch', 'plant fibre', 'berries', 'grubs', 'egg', 'cord', 'basket', 'roast', 'fish', 'rabbit'];

export const ITEM_FUEL: readonly number[] = [0, 0, 0, 30, 100, 0, 60, 80, 10, 0, 0, 0, 12, 20, 0, 0, 0];

export const FOOD_KCAL: Readonly<Record<number, number>> = { [ItemType.Berries]: 140, [ItemType.Grubs]: 110, [ItemType.Egg]: 160, [ItemType.Roast]: 320, [ItemType.Fish]: 190, [ItemType.Rabbit]: 280 };

export const STACK_STEP = 8;

export const STACK_STAGES = 5;

export const stackStage = (count: number): number => Math.min(STACK_STAGES - 1, Math.floor(count / STACK_STEP));
