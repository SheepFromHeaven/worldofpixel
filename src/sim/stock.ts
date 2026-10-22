import { capacityOf } from './area.ts';
import type { Building, ItemType as Item } from './types.ts';

export function held(building: Building, item: Item): number {
  return building.stock.get(item) ?? 0;
}

export function totalHeld(building: Building): number {
  let total = 0;
  for (const amount of building.stock.values()) total += amount;
  return total;
}

export function room(building: Building, item: Item): number {
  return Math.max(0, capacityOf(building) - held(building, item));
}

export function give(building: Building, item: Item, amount: number): number {
  const taken = Math.min(Math.max(0, amount), room(building, item));
  if (taken > 0) building.stock.set(item, held(building, item) + taken);
  return taken;
}

export function take(building: Building, item: Item, amount: number): number {
  const there = held(building, item);
  const taken = Math.min(Math.max(0, amount), there);
  if (taken <= 0) return 0;
  if (taken === there) building.stock.delete(item);
  else building.stock.set(item, there - taken);
  return taken;
}
