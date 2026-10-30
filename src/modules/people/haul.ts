import type { TileIndex } from '../../sim/grid.ts';
import { NOWHERE } from '../../sim/grid.ts';
import { Blueprint } from '../../sim/world.ts';
import { ItemType } from '../items/api.ts';
import { HAUL_REACH_TILES, Task } from './tuning.ts';
import type { People } from './people.ts';
import { isWonderSite } from './wonder.ts';

export function storageFor(people: People, person: number, kind: ItemType): TileIndex {
  const { world } = people;
  const x = people.posX[person]!;
  const y = people.posY[person]!;
  let found: TileIndex = NOWHERE;
  let least = Infinity;

  for (const tile of world.structures.storageTiles) {
    if (!world.structures.storageAccepts(tile, kind)) continue;
    const at = world.grid.centre(tile);
    const away = Math.hypot(at.x - x, at.y - y);
    if (away < least) {
      least = away;
      found = tile;
    }
  }
  return found;
}

export function carryToStorage(people: People, person: number): boolean {
  const carried = people.heldItemType[person];
  if (carried === ItemType.None || carried === ItemType.HandAxe || carried === ItemType.BurningBranch) return false;
  const tile = storageFor(people, person, people.heldItemType[person]! as ItemType);
  if (tile === NOWHERE) return false;

  people.sendToBring(person, tile);
  return true;
}

export function beginHaul(people: People, person: number): boolean {
  const { world } = people;
  if (world.structures.storageTiles.length === 0) return false;
  if (people.heldItemType[person] !== ItemType.None) return carryToStorage(people, person);
  const { items, grid } = world;
  const stocked = new Map<number, boolean>();
  const x = people.posX[person]!;
  const y = people.posY[person]!;
  let found = -1;
  let least = HAUL_REACH_TILES;

  for (let slot = 0; slot < items.used; slot += 1) {
    const kind = items.kind[slot]!;
    if (kind === ItemType.None || kind === ItemType.HandAxe || kind === ItemType.BurningBranch) continue;

    const tile = items.tile[slot]!;
    if (world.structures.storage[tile] === 1 || world.structures.floor[tile] === 1 || world.structures.plan[tile] !== Blueprint.None || items.at(tile).length !== 1 || !world.movement.passable(tile) || claimed(people, tile) || isWonderSite(people, tile)) continue;
    if (!stocked.has(kind)) stocked.set(kind, storageFor(people, person, kind as ItemType) !== NOWHERE);
    if (!stocked.get(kind)) continue;

    const at = grid.centre(tile);
    const away = Math.hypot(at.x - x, at.y - y);
    if (away < least) {
      least = away;
      found = slot;
    }
  }
  if (found < 0) return false;

  people.sendToPick(person, items.tile[found]!, items.kind[found]! as ItemType);
  people.hauling[person] = 1;
  return true;
}

export function claimed(people: People, tile: TileIndex): boolean {
  for (let person = 0; person < people.count; person += 1) if (people.task[person] !== Task.None && people.taskTile[person] === tile) return true;
  return false;
}

export function finishPick(people: People, person: number): void {
  const { items } = people.world;
  const tile = people.taskTile[person]!;
  const slot = items.find(tile, people.taskItem[person] as ItemType);
  if (slot < 0 || people.heldItemType[person] !== ItemType.None) return;

  people.heldItemType[person] = items.kind[slot]!;
  items.remove(slot);
  people.emit('pickup', person, tile);
}

export function finishChop(people: People, person: number): void {
  const tile = people.taskTile[person]!;
  if (!people.world.fell(tile)) return;

  people.world.items.add(tile, ItemType.Branch);
  people.emit('chop', person, tile);
}

export function finishPlant(people: People, person: number): void {
  const tile = people.taskTile[person]!;
  if (people.heldItemType[person] !== ItemType.Torch || !people.world.structures.plant(tile)) return;
  people.heldItemType[person] = ItemType.None;
  people.emit('plant', person, tile);
}
