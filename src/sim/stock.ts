import type { Building, ItemType as Item } from './types.ts';

/**
 * What a building is holding.
 *
 * A building used to be a grid of squares — doors, belts, crates, bins — that the player laid
 * out, and every question about its goods went through the floor plan: which square has room,
 * which door is this item's, what is riding the belt between them. The parameter layer replaced
 * all of that. What a building is *for* is a method in the book run on a rig; where a sack sits
 * inside it is not a decision anybody was making, and drawing it as one put a diagram of a
 * warehouse on a parcel.
 *
 * So a building holds a list. One number per item, a total it cannot exceed, and the slab shows
 * it. Everything here goes through these four functions rather than touching the map, because a
 * bypass shows up as goods that quietly stop moving.
 */

/** How much of an item is standing in the building. */
export function held(building: Building, item: Item): number {
  return building.stock.get(item) ?? 0;
}

/** Everything standing in it, whatever the items. A count of units, not a fill level. */
export function totalHeld(building: Building): number {
  let total = 0;
  for (const amount of building.stock.values()) total += amount;
  return total;
}

/**
 * How much more of an item it can take. Capacity is *per item*: every line on the shelf has the
 * same ceiling, so a store full of deadwood still has room for embers, and the slab can say
 * "3 of 8" beside each thing without a total nobody can see the sum of.
 */
export function room(building: Building, item: Item): number {
  return Math.max(0, building.design.capacity - held(building, item));
}

/** Put goods in, up to what there is room for. Returns how many went. */
export function give(building: Building, item: Item, amount: number): number {
  const taken = Math.min(Math.max(0, amount), room(building, item));
  if (taken > 0) building.stock.set(item, held(building, item) + taken);
  return taken;
}

/**
 * Take goods out. Returns how many came.
 *
 * A line that empties is deleted rather than left at zero: `stock` iterates in insertion order
 * and that order is in the trace, so two towns that reached the same shelf by different routes
 * have to look the same.
 */
export function take(building: Building, item: Item, amount: number): number {
  const there = held(building, item);
  const taken = Math.min(Math.max(0, amount), there);
  if (taken <= 0) return 0;
  if (taken === there) building.stock.delete(item);
  else building.stock.set(item, there - taken);
  return taken;
}
