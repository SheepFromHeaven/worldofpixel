import { ITEMS, itemIdOf } from '../../content/items/index.ts';

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

export const ITEM_NAMES: readonly string[] = ITEMS.map((item) => item.name);

export const ITEM_FUEL: readonly number[] = ITEMS.map((item) => item.fuel?.burn ?? 0);

export const FOOD_KCAL: Readonly<Record<number, number>> = Object.fromEntries(ITEMS.flatMap((item, id) => (item.food ? [[id, item.food.kcal]] : [])));

export const EDIBLE: ReadonlySet<number> = new Set(ITEMS.flatMap((item, id) => (item.food && !item.food.poisonous ? [id] : [])));

export const RAW_FOOD: ReadonlySet<number> = new Set(ITEMS.flatMap((item, id) => (item.food?.cooksTo ? [id] : [])));

export const COOKS_TO: ReadonlyMap<number, number> = new Map(ITEMS.flatMap((item, id) => (item.food?.cooksTo ? [[id, itemIdOf(item.food.cooksTo)] as const] : [])));

export const STACK_SIZE: readonly number[] = ITEMS.map((item) => item.stackable?.size ?? 1);

export const ITEM_ART: readonly string[] = ITEMS.map((item) => item.art);

export const itemId = (key: string): ItemType => itemIdOf(key) as ItemType;

for (const [name, id] of Object.entries(ItemType)) {
  const key = name.charAt(0).toLowerCase() + name.slice(1);
  if (ITEMS[id]?.key !== (id === 0 ? 'none' : key)) throw new Error(`item ${name} is ${id} but the registry has ${ITEMS[id]?.key}`);
}

export const STACK_STEP = 8;

export const STACK_STAGES = 5;

export const stackStage = (count: number): number => Math.min(STACK_STAGES - 1, Math.floor(count / STACK_STEP));
