import { methodById } from './book.ts';
import type { Book } from './book.ts';
import { cloneDesign } from './designs.ts';
import type { Vec2 } from './geometry.ts';
import { createRig } from './process.ts';
import { give, held, room, take, totalHeld } from './stock.ts';
import { BuildingState, ITEM_TYPES } from './types.ts';
import type { Building, BuildingId, CellId, Design, ItemType } from './types.ts';

export function createBuilding(
  id: BuildingId,
  design: Design,
  cellId: CellId,
  position: Vec2,
  yields: ItemType[],
): Building {
  const own = cloneDesign(design);
  return {
    id,
    designId: design.id,
    design: own,
    cellId,
    position,
    stock: new Map(),
    yields: [...yields],
    state: BuildingState.Idle,
    delivered: new Map(),
    producedTotal: 0,
    clearing: null,
    ...(own.rig ? { rig: createRig(own.rig, own.methods ?? []) } : {}),
  };
}

export function labelOf(building: Building): string {
  return building.design.label;
}

/** A store is somewhere anything may be left — the hearth, and nothing else so far. */
export function isStore(building: Building): boolean {
  return building.design.store === true;
}

/**
 * What a carrier may bring here.
 *
 * A store takes anything, because that is what being the destination of last resort means. Any
 * other building takes only what its rig is going to use: a cord walk is not a shelf, and a
 * load left in one is a load nothing will ever pick up again.
 */
export function acceptedItems(building: Building, book: Book): ItemType[] {
  if (room(building) <= 0) return [];
  if (isStore(building)) return [...ITEM_TYPES];

  const wanted: ItemType[] = [];
  for (const input of asksFor(building, book)) {
    if (!wanted.includes(input.item)) wanted.push(input.item);
  }
  return wanted;
}

/**
 * What every entry on this building's queue asks for, in queue order.
 *
 * Asked of the book each time rather than cached on the rig. A cache filled by the queue scan
 * is empty exactly when the scan has not run yet — which is the tick a rig is raised — so a new
 * cord walk accepted nothing at all, was never carried to, and refused its own method for ever.
 */
function asksFor(building: Building, book: Book): { item: ItemType; amount: number }[] {
  const rig = building.rig;
  if (!rig) return [];
  return rig.queue.flatMap((id) => methodById(book, id)?.inputs ?? []);
}

export function storedStock(building: Building, item: ItemType): number {
  return held(building, item);
}

export function supplies(building: Building, item: ItemType): boolean {
  return held(building, item) > 0;
}

/** How much of an item a full round of this building's work swallows. */
export function demandFor(building: Building, item: ItemType, book: Book): number {
  let demand = 0;
  for (const input of asksFor(building, book)) if (input.item === item) demand += input.amount;
  return demand;
}

export function depositHopper(building: Building, item: ItemType, amount: number): number {
  const placed = give(building, item, amount);
  // A lifetime receipt of what has been handed in, kept even after it is taken out again — it
  // is the only record of how much the town has ever moved.
  if (placed > 0 && isStore(building)) keep(building, item, placed);
  return placed;
}

/**
 * How much of an item a *carrier* may bring here. Not the same question as whether there is
 * room for it: a rig has room for what it makes and nobody carries that to it.
 */
export function hopperSpace(building: Building, item: ItemType, book: Book): number {
  return acceptedItems(building, book).includes(item) ? room(building) : 0;
}

/** Plain room, for the rig asking whether what it is about to make will fit. */
export function roomFor(building: Building): number {
  return room(building);
}

export function withdraw(building: Building, item: ItemType, amount: number): number {
  return take(building, item, amount);
}

/** How backed up this building is on an item — a full store is relieved first. */
export function outputPressure(building: Building, item: ItemType): number {
  if (held(building, item) <= 0) return 0;
  return totalHeld(building) / Math.max(1, building.design.holds);
}

function keep(building: Building, item: ItemType, amount: number): void {
  building.delivered.set(item, (building.delivered.get(item) ?? 0) + amount);
}

export interface ProcessOutcome {
  produced: ItemType[];
  delivered: { item: ItemType; amount: number }[];
}

/**
 * One unit drawn out of the ground by whoever is working the building.
 *
 * Straight into the building's own stock: a source used to hand its unit to the square it faced
 * and the line carried it to a crate, and there is no line now. False when there is no room, or
 * when the ground here does not hold it.
 */
export function drawFromGround(building: Building, item: ItemType): boolean {
  if (!building.yields.includes(item)) return false;
  if (give(building, item, 1) === 0) return false;
  building.producedTotal += 1;
  return true;
}

/** How many more units of an item this building could take before it is full. */
export function groundRoom(building: Building, item: ItemType): number {
  void item;
  return room(building);
}

/**
 * One tick of a building that is not a rig.
 *
 * There is almost nothing left to do here: the belts and the combines are gone with the floor
 * plan, and a rig is ticked by `runRig` in the engine. What remains is saying what the building
 * is, which the map and the slab both read.
 */
export function processBuilding(building: Building, tick: number, manned = false): ProcessOutcome {
  void tick;
  const outcome: ProcessOutcome = { produced: [], delivered: [] };
  if (building.clearing) {
    building.state = BuildingState.Clearing;
    return outcome;
  }
  building.state = manned
    ? BuildingState.Working
    : room(building) <= 0
      ? BuildingState.Blocked
      : BuildingState.Idle;
  return outcome;
}
