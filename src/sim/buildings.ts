import { areaLabel, capacityOf, isStoreArea, slotsFor, stillWanted } from './area.ts';
import type { Book } from './book.ts';
import { recipeById } from './book.ts';
import type { Vec2 } from './geometry.ts';
import { give, held, room, take } from './stock.ts';
import type { Building, BuildingId, CellId, ItemType } from './types.ts';
import { BuildingState, ITEM_TYPES } from './types.ts';

export function createBuilding(id: BuildingId, cellId: CellId, position: Vec2, yields: ItemType[]): Building {
  return {
    id,
    cellId,
    position,
    stock: new Map(),
    yields: [...yields],
    state: BuildingState.Idle,
    delivered: new Map(),
    producedTotal: 0,
    clearing: null,
    stage: 0,
    slots: slotsFor(0),
    queue: [],
  };
}

export function labelOf(building: Building): string {
  return areaLabel(building);
}

export function isStore(building: Building): boolean {
  return isStoreArea(building);
}

export function acceptedItems(building: Building, book: Book): ItemType[] {
  const items: ItemType[] = isStore(building) ? [...ITEM_TYPES] : [];
  if (!isStore(building)) {
    for (const input of asksFor(building, book)) if (!items.includes(input.item)) items.push(input.item);
  }
  for (const cost of stillWanted(building)) if (!items.includes(cost.item)) items.push(cost.item);
  return items.filter((item) => room(building, item) > 0);
}

function asksFor(building: Building, book: Book): { item: ItemType; amount: number }[] {
  return building.queue.flatMap((line) => recipeById(book, line.recipeId)?.inputs ?? []);
}

export function storedStock(building: Building, item: ItemType): number {
  return held(building, item);
}

export function depositHopper(building: Building, item: ItemType, amount: number): number {
  const placed = give(building, item, amount);
  if (placed > 0 && isStore(building)) keep(building, item, placed);
  return placed;
}

export function hopperSpace(building: Building, item: ItemType, book: Book): number {
  return acceptedItems(building, book).includes(item) ? room(building, item) : 0;
}

export function roomFor(building: Building, item: ItemType): number {
  return room(building, item);
}

export function withdraw(building: Building, item: ItemType, amount: number): number {
  return take(building, item, amount);
}

export function outputPressure(building: Building, item: ItemType): number {
  if (held(building, item) <= 0) return 0;
  return held(building, item) / Math.max(1, capacityOf(building));
}

function keep(building: Building, item: ItemType, amount: number): void {
  building.delivered.set(item, (building.delivered.get(item) ?? 0) + amount);
}

export interface ProcessOutcome {
  produced: ItemType[];
  delivered: { item: ItemType; amount: number }[];
}

export function groundRoom(building: Building, item: ItemType): number {
  return room(building, item);
}

export function processBuilding(building: Building, tick: number, manned = false): ProcessOutcome {
  void tick;
  const outcome: ProcessOutcome = { produced: [], delivered: [] };
  if (building.clearing) {
    building.state = BuildingState.Clearing;
    return outcome;
  }
  building.state = manned
    ? BuildingState.Working
    : [...building.stock.keys()].some((item) => room(building, item) <= 0)
      ? BuildingState.Blocked
      : BuildingState.Idle;
  return outcome;
}
