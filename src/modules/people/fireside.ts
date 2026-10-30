import type { TileIndex } from '../../sim/grid.ts';
import { AROUND, NOWHERE } from '../../sim/grid.ts';
import { Blueprint } from '../../sim/world.ts';
import { FEEDS, LOW_FUEL, fuelOf } from '../fire/api.ts';
import { ItemType } from '../items/api.ts';
import { EntityState } from './states.ts';
import { FEED_NOTICE_TILES, FEED_SEEK_TILES, FIRE_SEEK_TILES, HAUL_REACH_TILES, Task } from './tuning.ts';
import type { People } from './people.ts';
import { isWonderSite } from './wonder.ts';
import { claimed } from './haul.ts';

export function lighterFor(people: People, tile: TileIndex): number {
  return people.nearest(tile, (person) => people.heldItemType[person] === ItemType.Branch);
}

export function sideOf(people: People, person: number, fire: TileIndex): TileIndex {
  const { grid } = people.world;
  const column = grid.columnOf(fire);
  const row = grid.rowOf(fire);
  const x = people.posX[person]!;
  const y = people.posY[person]!;
  let side: TileIndex = NOWHERE;
  let least = Infinity;
  for (const [dx, dy] of AROUND) {
    const next = grid.at(column + dx, row + dy);
    if (!people.world.movement.passable(next)) continue;
    const at = grid.centre(next);
    const away = Math.hypot(at.x - x, at.y - y);
    if (away < least) {
      least = away;
      side = next;
    }
  }
  return side;
}

export function sendToLight(people: People, person: number, fire: TileIndex): void {
  people.buildTile[person] = NOWHERE;
  const side = sideOf(people, person, fire);
  if (side !== NOWHERE) people.assign(person, Task.Light, side, ItemType.None, EntityState.WalkingToItem);
}

export function feederFor(people: People, fire: TileIndex): number {
  return people.nearest(fire, (person) => FEEDS.includes(people.heldItemType[person]! as ItemType));
}

export function sendToFeed(people: People, person: number, fire: TileIndex = hungryFire(people, person, FEED_SEEK_TILES)): boolean {
  if (fire === NOWHERE || !FEEDS.includes(people.heldItemType[person]! as ItemType)) return false;
  const side = sideOf(people, person, fire);
  if (side === NOWHERE) return false;
  people.buildTile[person] = NOWHERE;
  people.assign(person, Task.Feed, side, ItemType.None, EntityState.WalkingToItem);
  return true;
}

export function hungryFire(people: People, person: number, reach: number): TileIndex {
  const { world } = people;
  const x = people.posX[person]!;
  const y = people.posY[person]!;
  let found: TileIndex = NOWHERE;
  let least = reach;
  for (const tile of world.structures.fires) {
    if (world.structures.fuelAt(tile) >= LOW_FUEL) continue;
    const at = world.grid.centre(tile);
    const away = Math.hypot(at.x - x, at.y - y);
    if (away < least) {
      least = away;
      found = tile;
    }
  }
  return found;
}

export function feeding(people: People): boolean {
  for (let person = 0; person < people.count; person += 1) if (people.task[person] === Task.Feed || people.hauling[person] === 2) return true;
  return false;
}

export function beginFeed(people: People, person: number): boolean {
  if (feeding(people)) return false;
  const fire = hungryFire(people, person, FEED_NOTICE_TILES);
  if (fire === NOWHERE) return false;
  const held = people.heldItemType[person]! as ItemType;
  if (FEEDS.includes(held)) return sendToFeed(people, person, fire);
  if (held !== ItemType.None) return false;

  const { items, grid } = people.world;
  const { floor, plan } = people.world.structures;
  const x = people.posX[person]!;
  const y = people.posY[person]!;
  let found = -1;
  let least = HAUL_REACH_TILES;
  for (let slot = 0; slot < items.used; slot += 1) {
    if (!FEEDS.includes(items.kind[slot]! as ItemType)) continue;
    const tile = items.tile[slot]!;
    if (floor[tile] === 1 || plan[tile] !== Blueprint.None || claimed(people, tile) || isWonderSite(people, tile)) continue;
    const at = grid.centre(tile);
    const away = Math.hypot(at.x - x, at.y - y);
    if (away < least) {
      least = away;
      found = slot;
    }
  }
  if (found < 0) return false;
  people.sendToPick(person, items.tile[found]!, items.kind[found]! as ItemType);
  people.hauling[person] = 2;
  return true;
}

export function nearestFire(people: People, x: number, y: number): TileIndex {
  const { world } = people;
  let found: TileIndex = NOWHERE;
  let least = FIRE_SEEK_TILES;
  for (const tile of world.structures.fires) {
    const at = world.grid.centre(tile);
    const away = Math.hypot(at.x - x, at.y - y);
    if (away < least) {
      least = away;
      found = tile;
    }
  }
  return found;
}

export function fireBeside(people: People, tile: TileIndex): TileIndex {
  const { grid } = people.world;
  for (const [dx, dy] of AROUND) {
    const next = grid.at(grid.columnOf(tile) + dx, grid.rowOf(tile) + dy);
    if (people.world.structures.isFire(next)) return next;
  }
  return NOWHERE;
}

export function besideFire(people: People, tile: TileIndex): boolean {
  return fireBeside(people, tile) !== NOWHERE;
}

export function finishFeed(people: People, person: number): void {
  const fire = fireBeside(people, people.taskTile[person]!);
  const held = people.heldItemType[person]! as ItemType;
  if (fire === NOWHERE || !FEEDS.includes(held) || !people.world.structures.stoke(fire, fuelOf(held))) return;
  people.heldItemType[person] = ItemType.None;
  people.emit('feed', person, fire);
}

export function finishLight(people: People, person: number): void {
  if (people.heldItemType[person] !== ItemType.Branch) return;
  people.heldItemType[person] = ItemType.Torch;
  people.emit('light', person, people.taskTile[person]!);
}
