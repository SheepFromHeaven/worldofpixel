import type { TileIndex } from '../../sim/grid.ts';
import { NOWHERE } from '../../sim/grid.ts';
import { Blueprint, Cover } from '../../sim/world.ts';
import { fuelOf } from '../fire/api.ts';
import { ItemType } from '../items/api.ts';
import { buildableOf, isBuildPlan, PLAN_BASE } from '../../content/buildables.ts';
import { EntityState } from '../people/api.ts';
import { Task } from '../people/api.ts';
import { CAMPFIRE_BRANCHES, KINDLE_BRANCHES, PLAN_NEEDS, RELIGHT_FLINT } from './tuning.ts';
import type { People } from '../people/api.ts';
import { sideOf } from '../people/api.ts';

export function sendToBuild(people: People, person: number, tile: TileIndex): void {
  if (beginPlanned(people, person)) return;
  people.buildTile[person] = tile;
  if (!nextBuildStep(people, person)) people.idle(person);
}

export function abandonPlan(people: People, tile: TileIndex): void {
  for (let person = 0; person < people.count; person += 1) {
    if (people.buildTile[person] !== tile) continue;
    people.buildTile[person] = NOWHERE;
    if (people.task[person] === Task.Pick || people.task[person] === Task.Bring) people.idle(person);
  }
}

export function beginPlanned(people: People, person: number): boolean {
  const held = people.heldItemType[person];
  if (held !== ItemType.None && held !== ItemType.Branch) return false;
  const { world } = people;
  const near = world.structures.plans;
  for (const tile of near) {
    people.buildTile[person] = tile;
    if (nextBuildStep(people, person)) return true;
  }
  people.buildTile[person] = NOWHERE;
  return false;
}

export function available(people: People, kind: ItemType, tile: TileIndex): number {
  const { items } = people.world;
  const { floor } = people.world.structures;
  let found = items.tally(tile, kind);
  for (let slot = 0; slot < items.used; slot += 1) {
    if (items.kind[slot] === kind && items.tile[slot] !== tile && floor[items.tile[slot]!] === 0) found += 1;
  }
  return found;
}

export function nearestItem(people: People, person: number, kind: ItemType, besides: TileIndex, floorsToo: boolean): number {
  const { items, grid } = people.world;
  const { floor } = people.world.structures;
  const x = people.posX[person]!;
  const y = people.posY[person]!;
  let found = -1;
  let least = Infinity;
  for (let slot = 0; slot < items.used; slot += 1) {
    if (items.kind[slot] !== kind) continue;
    const tile = items.tile[slot]!;
    if (tile === besides || (!floorsToo && floor[tile] === 1) || people.world.structures.plan[tile] !== Blueprint.None || slotTaken(people, slot, person)) continue;
    const at = grid.centre(tile);
    const away = Math.hypot(at.x - x, at.y - y);
    if (away < least) {
      least = away;
      found = slot;
    }
  }
  return found;
}

export function inbound(people: People, site: TileIndex, kind: ItemType, except: number): number {
  let found = 0;
  for (let other = 0; other < people.count; other += 1) {
    if (other === except || people.buildTile[other] !== site) continue;
    if (people.heldItemType[other] === kind || (people.task[other] === Task.Pick && people.taskItem[other] === kind)) found += 1;
  }
  return found;
}

export function missing(people: People, site: TileIndex): ItemType {
  for (const [kind, count] of PLAN_NEEDS[people.world.structures.plan[site]!] ?? []) if (people.world.items.tally(site, kind) < count) return kind;
  return ItemType.None;
}

export function deficit(people: People, site: TileIndex, person: number): ItemType {
  for (const [kind, count] of PLAN_NEEDS[people.world.structures.plan[site]!] ?? []) if (people.world.items.tally(site, kind) + inbound(people, site, kind, person) < count) return kind;
  return ItemType.None;
}

export function needed(people: People, site: TileIndex, kind: ItemType, person: number): boolean {
  return (PLAN_NEEDS[people.world.structures.plan[site]!] ?? []).some(([wanted, count]) => wanted === kind && people.world.items.tally(site, kind) + inbound(people, site, kind, person) < count);
}

export function slotTaken(people: People, slot: number, person: number): boolean {
  const { items } = people.world;
  const tile = items.tile[slot]!;
  const kind = items.kind[slot]!;
  let pickers = 0;
  for (let other = 0; other < people.count; other += 1) if (other !== person && people.task[other] === Task.Pick && people.taskTile[other] === tile && people.taskItem[other] === kind) pickers += 1;
  return pickers >= items.tally(tile, kind as ItemType);
}

export function nextBuildStep(people: People, person: number): boolean {
  const site = people.buildTile[person]!;
  const plan = people.world.structures.plan[site]!;
  if (plan === Blueprint.None) return false;
  const { items } = people.world;
  const held = people.heldItemType[person]! as ItemType;
  const want = deficit(people, site, person);
  if (isBuildPlan(plan) && buildableOf(plan - PLAN_BASE)?.ground.clears && people.world.cover[site] !== Cover.Bare && people.world.cover[site] !== Cover.Boulder) people.world.plants.clearAll(site);

  if (held === ItemType.BurningBranch && plan === Blueprint.Campfire && missing(people, site) === ItemType.None) {
    people.assign(person, Task.Bring, site, ItemType.None, EntityState.Carrying);
    return true;
  }
  if (held !== ItemType.None) {
    if (needed(people, site, held, person)) {
      people.assign(person, Task.Bring, site, ItemType.None, EntityState.Carrying);
      return true;
    }
    if (!people.dropHeld(person)) return false;
    return nextBuildStep(people, person);
  }
  if (want !== ItemType.None) {
    for (const [kind, count] of PLAN_NEEDS[plan] ?? []) {
      if (items.tally(site, kind) + inbound(people, site, kind, person) >= count) continue;
      const slot = nearestItem(people, person, kind, site, false);
      if (slot < 0) continue;
      people.assign(person, Task.Pick, items.tile[slot]!, kind, EntityState.WalkingToItem);
      return true;
    }
    return false;
  }
  if (missing(people, site) !== ItemType.None) return false;
  if (plan === Blueprint.Campfire) {
    if (inbound(people, site, ItemType.BurningBranch, person) > 0) return false;
    const slot = nearestItem(people, person, ItemType.BurningBranch, NOWHERE, true);
    if (slot < 0) return false;
    people.assign(person, Task.Pick, items.tile[slot]!, ItemType.BurningBranch, EntityState.WalkingToItem);
    return true;
  }
  people.assign(person, Task.Bring, site, ItemType.None, EntityState.Carrying);
  return true;
}

export function finishCampfire(people: People, person: number, site: TileIndex): void {
  const { world } = people;
  const { items } = world;
  let fuel = 0;
  for (let used = 0; used < CAMPFIRE_BRANCHES; used += 1) {
    const slot = items.find(site, ItemType.Branch);
    if (slot < 0) continue;
    fuel += fuelOf(ItemType.Branch);
    items.remove(slot);
  }
  people.heldItemType[person] = ItemType.None;
  people.buildTile[person] = NOWHERE;
  if (world.structures.kindle(site, fuel) && !people.knowledge.hasDiscoveredFire) {
    people.knowledge.hasDiscoveredFire = true;
    people.emit('discovery', person, site);
  }
  people.idle(person);
}

export function finishStation(people: People, person: number, site: TileIndex): void {
  const { world } = people;
  const { items } = world;
  const plan = world.structures.plan[site]!;
  for (const [kind, count] of PLAN_NEEDS[plan] ?? []) {
    for (let used = 0; used < count; used += 1) {
      const slot = items.find(site, kind);
      if (slot >= 0) items.remove(slot);
    }
  }
  people.buildTile[person] = NOWHERE;
  const id = plan - PLAN_BASE;
  world.structures.raise(site, id, world.structures.turn[site]!);
  if (buildableOf(id)?.solid) {
    const aside = sideOf(people, person, site);
    if (aside !== NOWHERE) {
      const at = world.grid.centre(aside);
      people.posX[person] = at.x;
      people.posY[person] = at.y;
    }
  }
  people.idle(person);
}

export function finishRelight(people: People, person: number, site: TileIndex): void {
  const { world } = people;
  const { items } = world;
  let fuel = 0;
  if (!world.structures.canKindle(site)) {
    world.structures.unplan(site);
    people.buildTile[person] = NOWHERE;
    people.idle(person);
    return;
  }
  const fresh = world.structures.plan[site] === Blueprint.Kindle;
  const burn: ItemType[] = fresh ? Array<ItemType>(KINDLE_BRANCHES).fill(ItemType.Branch) : [ItemType.DryKindling, ItemType.Branch];
  for (const kind of burn) {
    const slot = items.find(site, kind);
    if (slot < 0) continue;
    fuel += fuelOf(kind);
    items.remove(slot);
  }
  const spot = sideOf(people, person, site);
  for (let struck = 0; struck < (fresh ? 0 : RELIGHT_FLINT); struck += 1) {
    const slot = items.find(site, ItemType.Flint);
    if (slot < 0) break;
    items.remove(slot);
    if (spot !== NOWHERE) items.add(spot, ItemType.Flint);
  }
  people.buildTile[person] = NOWHERE;
  if (world.structures.kindle(site, fuel) && fresh && !people.knowledge.hasDiscoveredFire) {
    people.knowledge.hasDiscoveredFire = true;
    people.emit('discovery', person, site);
  }
  people.idle(person);
}
