import type { TileIndex } from '../../sim/grid.ts';
import { AROUND, NOWHERE } from '../../sim/grid.ts';
import { Blueprint } from '../construction/api.ts';
import { COOKS_TO, EDIBLE, FOOD_KCAL, ItemType, RAW_FOOD, evaluate, roll } from '../items/api.ts';
import { neuronIndex } from '../mind/api.ts';
import { EntityState } from './states.ts';
import { REACH_TRIES, DRINK_SEEK_TILES, FISH_CASTS, FISH_SHORE_TILES, FORAGE_SEEK_TILES, FULL_STOMACH_KCAL, GATHER_KCAL, HAUL_REACH_TILES, KCAL_PER_HUNGER, SCAVENGE_SAMPLES, SCAVENGE_SEEK_TILES, Task, WORTH_A_WALK_KCAL, clamp01 } from './tuning.ts';
import type { People } from './people.ts';
import { isWonderSite } from './wonder.ts';
import { storageFor, carryToStorage, claimed } from './haul.ts';
import { sideOf } from './fireside.ts';

export function shoreFor(people: People, person: number): TileIndex {
  const { world } = people;
  const { grid } = world;
  const x = people.posX[person]!;
  const y = people.posY[person]!;
  const reach = Math.ceil(DRINK_SEEK_TILES);
  const column = grid.column(x);
  const row = grid.row(y);
  let found: TileIndex = NOWHERE;
  let least = DRINK_SEEK_TILES * DRINK_SEEK_TILES;

  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const near = dx * dx + dy * dy;
      if (near >= least) continue;
      const tile = grid.at(column + dx, row + dy);
      if (!world.movement.passable(tile) || world.structures.fire[tile] !== 0 || people.snagged(tile)) continue;
      if (waterBeside(people, tile) === NOWHERE) continue;
      least = near;
      found = tile;
    }
  }
  return found;
}

export function waterBeside(people: People, tile: TileIndex): TileIndex {
  const { grid } = people.world;
  for (const [dx, dy] of AROUND) {
    const next = grid.at(grid.columnOf(tile) + dx, grid.rowOf(tile) + dy);
    if (people.world.drinkable(next)) return next;
  }
  return NOWHERE;
}

export function beginDrink(people: People, person: number): boolean {
  const shore = shoreFor(people, person);
  if (shore === NOWHERE) return false;
  people.buildTile[person] = NOWHERE;
  people.hauling[person] = 0;
  people.assign(person, Task.Drink, shore, ItemType.None, EntityState.WalkingToItem);
  return true;
}

export function beginAngle(people: People, person: number): boolean {
  const { world } = people;
  if (!people.catchFish || world.structures.storageTiles.length === 0) {
    people.angling.fill(0);
    return false;
  }
  const held = people.heldItemType[person]! as ItemType;
  if (held !== ItemType.None) return held === ItemType.Fish && carryToStorage(people, person);
  if (storageFor(people, person, ItemType.Fish) === NOWHERE) return false;
  const shore = shoreByFish(people, person);
  if (shore === NOWHERE) return false;
  people.buildTile[person] = NOWHERE;
  people.hauling[person] = 0;
  people.assign(person, Task.Fish, shore, ItemType.None, EntityState.WalkingToItem);
  return true;
}

export function shoreByFish(people: People, person: number): TileIndex {
  const shoal = people.findFish?.(people.posX[person]!, people.posY[person]!);
  if (!shoal) return NOWHERE;
  const { world } = people;
  const { grid } = world;
  const column = grid.column(shoal.x);
  const row = grid.row(shoal.y);
  let found: TileIndex = NOWHERE;
  let least = Infinity;
  for (let dy = -FISH_SHORE_TILES; dy <= FISH_SHORE_TILES; dy += 1) {
    for (let dx = -FISH_SHORE_TILES; dx <= FISH_SHORE_TILES; dx += 1) {
      const near = dx * dx + dy * dy;
      if (near >= least) continue;
      const tile = grid.at(column + dx, row + dy);
      if (!world.movement.passable(tile) || world.structures.fire[tile] !== 0 || people.snagged(tile) || waterBeside(people, tile) === NOWHERE) continue;
      least = near;
      found = tile;
    }
  }
  return found;
}

export function finishFish(people: People, person: number): void {
  people.task[person] = Task.None;
  const water = waterBeside(people, people.taskTile[person]!);
  if (water === NOWHERE || !people.catchFish) return;
  const at = people.world.grid.centre(water);
  for (let cast = 0; cast < FISH_CASTS; cast += 1) {
    if (!people.catchFish(at.x, at.y)) continue;
    people.heldItemType[person] = ItemType.Fish;
    people.emit('forage', person, people.taskTile[person]!);
    if (!carryToStorage(people, person)) people.dropHeld(person);
    return;
  }
}

export function beginGather(people: People, person: number): boolean {
  const { world } = people;
  if (world.structures.storageTiles.length === 0) {
    people.gathering.fill(0);
    return false;
  }
  const held = people.heldItemType[person]! as ItemType;
  if (held !== ItemType.None) return EDIBLE.has(held) && carryToStorage(people, person);

  const { items, grid } = world;
  const { floor, plan, storage } = world.structures;
  const x = people.posX[person]!;
  const y = people.posY[person]!;
  const stocked = new Map<number, boolean>();
  let found = -1;
  let least = HAUL_REACH_TILES;
  for (let slot = 0; slot < items.used; slot += 1) {
    const kind = items.kind[slot]!;
    if (!EDIBLE.has(kind)) continue;
    const tile = items.tile[slot]!;
    if (storage[tile] === 1 || floor[tile] === 1 || plan[tile] !== Blueprint.None || !world.movement.passable(tile) || claimed(people, tile) || isWonderSite(people, tile)) continue;
    if (!stocked.has(kind)) stocked.set(kind, storageFor(people, person, kind as ItemType) !== NOWHERE);
    if (!stocked.get(kind)) continue;
    const at = grid.centre(tile);
    const away = Math.hypot(at.x - x, at.y - y);
    if (away < least) {
      least = away;
      found = slot;
    }
  }
  if (found >= 0) {
    people.sendToPick(person, items.tile[found]!, items.kind[found]! as ItemType);
    people.hauling[person] = 1;
    return true;
  }

  if (storageFor(people, person, ItemType.Berries) === NOWHERE) return false;
  const fruit = fruitFor(people, person);
  if (fruit === NOWHERE) return false;
  people.buildTile[person] = NOWHERE;
  people.assign(person, Task.Forage, fruit, ItemType.None, EntityState.WalkingToItem);
  people.hauling[person] = 5;
  return true;
}

export function rawFoodSlot(people: People, person: number): number {
  const { items, grid } = people.world;
  const { floor, plan } = people.world.structures;
  const x = people.posX[person]!;
  const y = people.posY[person]!;
  let found = -1;
  let least = Infinity;
  for (let slot = 0; slot < items.used; slot += 1) {
    const kind = items.kind[slot];
    if (!RAW_FOOD.has(kind!)) continue;
    const tile = items.tile[slot]!;
    if (floor[tile] === 1 || plan[tile] !== Blueprint.None || isWonderSite(people, tile)) continue;
    const at = grid.centre(tile);
    const away = Math.hypot(at.x - x, at.y - y);
    if (away < least) {
      least = away;
      found = slot;
    }
  }
  return found;
}

export function holdsRaw(people: People, person: number): boolean {
  const held = people.heldItemType[person];
  return RAW_FOOD.has(held!);
}

export function roasterFor(people: People, fire: TileIndex): number {
  return people.nearest(fire, (person) => holdsRaw(people, person) || (people.heldItemType[person] === ItemType.None && rawFoodSlot(people, person) >= 0));
}

export function sendToRoast(people: People, person: number, fire: TileIndex): boolean {
  const side = sideOf(people, person, fire);
  if (side === NOWHERE) return false;
  people.buildTile[person] = NOWHERE;
  people.roastFire[person] = fire;
  if (holdsRaw(people, person)) {
    people.assign(person, Task.Roast, side, ItemType.None, EntityState.WalkingToItem);
    return true;
  }
  const slot = rawFoodSlot(people, person);
  if (slot < 0 || people.heldItemType[person] !== ItemType.None) return false;
  people.sendToPick(person, people.world.items.tile[slot]!, people.world.items.kind[slot]! as ItemType);
  people.hauling[person] = 4;
  return true;
}

export function finishRoast(people: People, person: number): void {
  people.task[person] = Task.None;
  const cooked = COOKS_TO.get(people.heldItemType[person]!);
  if (cooked !== undefined) {
    people.heldItemType[person] = cooked as ItemType;
    people.emit('feed', person, people.taskTile[person]!);
    people.roastFire[person] = NOWHERE;
    if (!carryToStorage(people, person)) people.dropHeld(person);
    return;
  }
  people.roastFire[person] = NOWHERE;
}

export function beginEat(people: People, person: number): boolean {
  const held = people.heldItemType[person]! as ItemType;
  if (EDIBLE.has(held)) {
    eatHeld(people, person);
    return true;
  }
  if (held !== ItemType.None) return false;
  let fruit = fruitFor(people, person);
  if (fruit !== NOWHERE && !people.canReach(person, fruit)) {
    people.snag(fruit);
    fruit = NOWHERE;
  }
  const slot = edibleSlot(people, person, fruit === NOWHERE ? FORAGE_SEEK_TILES : distanceTo(people, person, fruit));
  if (slot >= 0) {
    const { items } = people.world;
    people.sendToPick(person, items.tile[slot]!, items.kind[slot]! as ItemType);
    people.hauling[person] = 3;
    return true;
  }
  if (fruit === NOWHERE) return false;
  people.buildTile[person] = NOWHERE;
  people.hauling[person] = 0;
  people.assign(person, Task.Forage, fruit, ItemType.None, EntityState.WalkingToItem);
  return true;
}

function distanceTo(people: People, person: number, tile: TileIndex): number {
  const at = people.world.grid.centre(tile);
  return Math.hypot(at.x - people.posX[person]!, at.y - people.posY[person]!);
}

function edibleSlot(people: People, person: number, within: number): number {
  const { items } = people.world;
  const { floor, plan } = people.world.structures;
  const candidates: { slot: number; away: number }[] = [];
  for (let slot = 0; slot < items.used; slot += 1) {
    const kind = items.kind[slot]!;
    if (!EDIBLE.has(kind)) continue;
    const tile = items.tile[slot]!;
    if (floor[tile] === 1 || plan[tile] !== Blueprint.None || claimed(people, tile) || isWonderSite(people, tile) || !people.world.movement.passable(tile)) continue;
    const away = distanceTo(people, person, tile);
    if (away < within) candidates.push({ slot, away });
  }
  candidates.sort((a, b) => a.away - b.away);
  return candidates.slice(0, REACH_TRIES).find((one) => people.canReach(person, items.tile[one.slot]!))?.slot ?? -1;
}

export function eatHeld(people: People, person: number): void {
  const kcal = FOOD_KCAL[people.heldItemType[person]!];
  if (kcal === undefined) return;
  people.heldItemType[person] = ItemType.None;
  people.hunger[person] = clamp01(people.hunger[person]! - kcal / KCAL_PER_HUNGER);
  people.emit('forage', person, people.tileOf(person));
}

export function fruitLayer(people: People, tile: TileIndex): 'canopy' | 'under' | null {
  const { plants } = people.world;
  const high = plants.fruitKcal(tile, 'canopy');
  const low = plants.fruitKcal(tile, 'under');
  if (high < WORTH_A_WALK_KCAL && low < WORTH_A_WALK_KCAL) return null;
  return high >= low ? 'canopy' : 'under';
}

export function fruitFor(people: People, person: number): TileIndex {
  const { world } = people;
  const { grid, plants } = world;
  const column = grid.column(people.posX[person]!);
  const row = grid.row(people.posY[person]!);
  const reach = FORAGE_SEEK_TILES;
  let found: TileIndex = NOWHERE;
  let least = reach * reach;

  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const near = dx * dx + dy * dy;
      if (near >= least) continue;
      const tile = grid.at(column + dx, row + dy);
      if (tile === NOWHERE || (plants.canopy[tile] === 0 && plants.under[tile] === 0)) continue;
      if (!world.movement.passable(tile) || claimed(people, tile) || fruitLayer(people, tile) === null) continue;
      least = near;
      found = tile;
    }
  }
  return found;
}

export function loose(people: People, kind: ItemType): number {
  const { items } = people.world;
  const { structures } = people.world;
  let found = 0;
  for (let slot = 0; slot < items.used; slot += 1) {
    if (items.kind[slot] !== kind) continue;
    const tile = items.tile[slot]!;
    if (structures.isStorage(tile) || structures.isFloor(tile) || structures.plan[tile] !== Blueprint.None) continue;
    found += 1;
  }
  return found;
}

export function beginScavenge(people: People, person: number): boolean {
  const { world } = people;
  const { grid } = world;
  const column = grid.column(people.posX[person]!);
  const row = grid.row(people.posY[person]!);
  let found: TileIndex = NOWHERE;
  let least = Infinity;
  for (let sample = 0; sample < SCAVENGE_SAMPLES; sample += 1) {
    const angle = people.random() * Math.PI * 2;
    const reach = 1 + people.random() * people.random() * (SCAVENGE_SEEK_TILES - 1);
    const tile = grid.at(column + Math.round(Math.cos(angle) * reach), row + Math.round(Math.sin(angle) * reach));
    if (tile === NOWHERE || reach >= least || !world.movement.passable(tile) || world.river[tile] !== 0 || claimed(people, tile)) continue;
    if (world.structures.isStorage(tile) || world.structures.isFloor(tile) || world.structures.plan[tile] !== Blueprint.None) continue;
    if (evaluate(world, tile) === null) continue;
    least = reach;
    found = tile;
  }
  if (found === NOWHERE) return false;
  people.buildTile[person] = NOWHERE;
  people.hauling[person] = 0;
  people.assign(person, Task.Scavenge, found, ItemType.None, EntityState.WalkingToItem);
  return true;
}

export function finishScavenge(people: People, person: number): void {
  const tile = people.taskTile[person]!;
  people.task[person] = Task.None;
  const { structures } = people.world;
  if (structures.isStorage(tile) || structures.isFloor(tile) || structures.plan[tile] !== Blueprint.None) return;
  const environment = evaluate(people.world, tile);
  if (environment === null) return;
  const kind = roll(environment, () => people.random(), (item) => loose(people, item));
  if (kind !== ItemType.None) people.world.items.add(tile, kind);
}

export function finishForage(people: People, person: number): void {
  const tile = people.taskTile[person]!;
  const { plants } = people.world;
  if (people.hauling[person] === 5) {
    for (const layer of ['canopy', 'under'] as const) {
      if (plants.pick(tile, layer, GATHER_KCAL) > 0) {
        people.heldItemType[person] = ItemType.Berries;
        people.mind?.learn(neuronIndex('berries'), person);
        break;
      }
    }
    people.task[person] = Task.None;
    return;
  }
  let hungry = (people.hunger[person]! * KCAL_PER_HUNGER) | 0;
  let eaten = 0;
  for (const layer of ['canopy', 'under'] as const) {
    if (hungry <= 0 || eaten >= FULL_STOMACH_KCAL) break;
    const bite = plants.pick(tile, layer, Math.min(hungry, FULL_STOMACH_KCAL - eaten));
    eaten += bite;
    hungry -= bite;
  }
  people.hunger[person] = clamp01(people.hunger[person]! - eaten / KCAL_PER_HUNGER);
  people.task[person] = Task.None;
  if (eaten > 0) {
    people.mind?.learn(neuronIndex('berries'), person);
    people.emit('forage', person, tile);
  }
}

export function finishDrink(people: People, person: number): void {
  people.task[person] = Task.None;
}
