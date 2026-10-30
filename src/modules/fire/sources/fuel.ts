import { ITEMS } from '../../../content/items/index.ts';
import type { ItemType as ItemKind } from '../../items/api.ts';
import { ITEM_FUEL } from '../../items/api.ts';
import { CAMPFIRE } from '../content/stations/campfire/index.ts';


export const FUEL_CAPACITY = CAMPFIRE.fuelled!.capacity;

export const FULL_FLAME_FUEL = CAMPFIRE.fuelled!.start;

export const LOW_FUEL = 150;

export const BURN_PER_SECOND = CAMPFIRE.fuelled!.burn;

export const FEEDS: readonly ItemKind[] = ITEMS.flatMap((item, id) => (item.fuel?.feeds ? [id as ItemKind] : []));

export const fuelOf = (kind: ItemKind): number => ITEM_FUEL[kind] ?? 0;

export const fireLevel = (fuel: number): number => Math.min(1.25, 0.25 + (0.75 * fuel) / FULL_FLAME_FUEL);

export const FLAME_TIERS = 5;

export const flameTier = (fuel: number): number => {
  const share = fuel / FULL_FLAME_FUEL;
  return share < 0.1 ? 0 : share < 0.3 ? 1 : share < 0.6 ? 2 : share < 1 ? 3 : 4;
};

export const reachScale = (level: number): number => 0.55 + 0.45 * level;
