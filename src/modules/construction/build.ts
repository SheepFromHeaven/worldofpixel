import type { TileIndex } from '../../sim/grid.ts';
import { NOWHERE } from '../../sim/grid.ts';
import { Cover } from '../../sim/world.ts';
import { Blueprint } from './structures.ts';
import { fuelOf } from '../fire/api.ts';
import { FORAGE, ItemType, evaluate } from '../items/api.ts';
import { buildableOf, buildableOfPlan, isBuildPlan, PLAN_BASE } from '../../content/buildables.ts';
import { stationOf } from '../../content/stations/index.ts';
import { EntityState } from '../people/api.ts';
import { Task } from '../people/api.ts';
import { SCAVENGE_SAMPLES, SCAVENGE_SEEK_TILES, SCAVENGE_SECONDS } from '../people/api.ts';
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
    if (people.task[person] === Task.Pick || people.task[person] === Task.Bring || people.task[person] === Task.Labour) people.idle(person);
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
    if (tile === besides || (!floorsToo && floor[tile] === 1) || people.world.structures.plan[tile] !== Blueprint.None || people.snagged(tile) || slotTaken(people, slot, person)) continue;
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
    if (people.heldItemType[other] === kind || ((people.task[other] === Task.Pick || people.task[other] === Task.Labour) && people.taskItem[other] === kind)) found += 1;
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
  const building = isBuildPlan(plan);
  if (building && needsClearing(people, site) && !labouring(people, site, person)) {
    people.assign(person, Task.Labour, site, ItemType.None, EntityState.WalkingToItem);
    return true;
  }

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
      if (slot < 0) return seek(people, person, site, kind);
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
  if (building && labouring(people, site, person)) return false;
  people.assign(person, Task.Bring, site, ItemType.None, EntityState.Carrying);
  return true;
}

const yields = (environment: number, kind: ItemType): number => {
  const table = FORAGE[environment as keyof typeof FORAGE];
  const total = table.nothing + table.drops.reduce((sum, entry) => sum + entry.weight, 0);
  const entry = table.drops.find((drop) => drop.kind === kind);
  return entry ? entry.weight / total : 0;
};

export function seek(people: People, person: number, site: TileIndex, kind: ItemType): boolean {
  const { world } = people;
  const { grid, structures } = world;
  const column = grid.columnOf(site);
  const row = grid.rowOf(site);
  let found: TileIndex = NOWHERE;
  let least = Infinity;
  for (let sample = 0; sample < SCAVENGE_SAMPLES; sample += 1) {
    const angle = people.random() * Math.PI * 2;
    const reach = 1 + people.random() * people.random() * (SCAVENGE_SEEK_TILES - 1);
    const tile = grid.at(column + Math.round(Math.cos(angle) * reach), row + Math.round(Math.sin(angle) * reach));
    if (tile === NOWHERE || reach >= least || !world.movement.passable(tile) || world.river[tile] !== 0 || people.snagged(tile)) continue;
    if (structures.isStorage(tile) || structures.isFloor(tile) || structures.plan[tile] !== Blueprint.None) continue;
    const environment = evaluate(world, tile);
    if (environment === null || yields(environment, kind) === 0) continue;
    least = reach;
    found = tile;
  }
  if (found === NOWHERE) return false;
  people.assign(person, Task.Labour, found, kind, EntityState.WalkingToItem);
  return true;
}

export function needsClearing(people: People, site: TileIndex): boolean {
  const { world } = people;
  if (!buildableOfPlan(world.structures.plan[site]!)?.ground.clears) return false;
  return world.structures.tilesOf(site).some((tile) => world.cover[tile] !== Cover.Boulder && world.plants.occupied(tile));
}

export function labouring(people: People, site: TileIndex, except: number): boolean {
  for (let other = 0; other < people.count; other += 1) if (other !== except && people.state[other] === EntityState.Labouring && people.buildTile[other] === site && people.taskItem[other] === ItemType.None) return true;
  return false;
}

export function labourSeconds(people: People, site: TileIndex): number {
  const plan = people.world.structures.plan[site]!;
  const def = buildableOfPlan(plan);
  if (def) return needsClearing(people, site) ? def.labour.clear : def.labour.build;
  const standing = stationOf(people.world.structures.built[site]!) ?? buildableOf(people.world.structures.block[site]!);
  return standing?.labour.raze ?? 0;
}

export function beginLabour(people: People, person: number, site: TileIndex, at: TileIndex): void {
  people.buildTile[person] = site;
  people.task[person] = Task.Labour;
  people.taskTile[person] = at;
  people.taskItem[person] = ItemType.None;
  people.state[person] = EntityState.Labouring;
  people.timer[person] = labourSeconds(people, site);
  people.targetX[person] = people.posX[person]!;
  people.targetY[person] = people.posY[person]!;
}

export function sendToRaze(people: People, person: number, tile: TileIndex): boolean {
  const { structures, movement } = people.world;
  const site = structures.anchorOf(tile);
  if (structures.hasStructure(site) === false || structures.isPlanned(site) || labouring(people, site, person)) return false;
  const stand = movement.passable(site) ? site : sideOf(people, person, site);
  if (stand === NOWHERE) return false;
  people.buildTile[person] = site;
  people.assign(person, Task.Labour, stand, ItemType.None, EntityState.WalkingToItem);
  return true;
}

export function arriveLabour(people: People, person: number, at: TileIndex): boolean {
  const { structures } = people.world;
  const site = people.buildTile[person]!;
  if (site === NOWHERE) return false;
  if (structures.isPlanned(site)) {
    if (!isBuildPlan(structures.plan[site]!)) return false;
    if (people.taskItem[person] !== ItemType.None) {
      people.taskTile[person] = at;
      people.state[person] = EntityState.Labouring;
      people.timer[person] = SCAVENGE_SECONDS;
      people.targetX[person] = people.posX[person]!;
      people.targetY[person] = people.posY[person]!;
      return true;
    }
    if (needsClearing(people, site) || missing(people, site) === ItemType.None) {
      if (labouring(people, site, person)) return false;
      beginLabour(people, person, site, at);
      return true;
    }
    return nextBuildStep(people, person);
  }
  if (!structures.hasStructure(site) || labouring(people, site, person)) return false;
  beginLabour(people, person, site, at);
  return true;
}

export function finishLabour(people: People, person: number): boolean {
  const { world } = people;
  const site = people.buildTile[person]!;
  if (site === NOWHERE) return false;
  if (world.structures.isPlanned(site)) {
    if (!isBuildPlan(world.structures.plan[site]!)) return false;
    const wanted = people.taskItem[person]! as ItemType;
    if (wanted !== ItemType.None) {
      const at = people.taskTile[person]!;
      const environment = evaluate(world, at);
      people.taskItem[person] = ItemType.None;
      if (environment !== null && people.random() < Math.min(0.95, yields(environment, wanted) * 2)) world.items.add(at, wanted);
      return nextBuildStep(people, person);
    }
    if (needsClearing(people, site)) {
      for (const tile of world.structures.tilesOf(site)) if (world.cover[tile] !== Cover.Boulder) world.plants.clearAll(tile);
      return nextBuildStep(people, person);
    }
    if (missing(people, site) === ItemType.None) {
      finishStation(people, person, site);
      return true;
    }
    return nextBuildStep(people, person);
  }
  world.structures.demolish(site);
  return false;
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
