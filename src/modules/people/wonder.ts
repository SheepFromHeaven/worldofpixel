import type { TileIndex } from '../../sim/grid.ts';
import { AROUND, NOWHERE } from '../../sim/grid.ts';
import { Blueprint } from '../../sim/world.ts';
import { ITEM_NAMES, ItemType } from '../items/api.ts';
import type { Hypothesis } from '../mind/api.ts';
import { neuronOf } from '../mind/api.ts';
import { EntityState } from './states.ts';
import { STRIKE_INTERVAL, Task, WONDER_SECONDS } from './tuning.ts';
import type { People } from './people.ts';

export function isWonderSite(people: People, tile: TileIndex): boolean {
  for (let person = 0; person < people.count; person += 1) if (people.wonderTile[person] === tile) return true;
  return false;
}

export function beginWonder(people: People, person: number): boolean {
  const { mind } = people;
  if (!mind) return false;
  const job = mind.claim(person);
  if (!job) return false;
  people.buildTile[person] = NOWHERE;
  people.hauling[person] = 0;
  people.wonder[person] = job.id;
  return startGather(people, person, job.tile);
}

export function startGather(people: People, person: number, given: TileIndex): boolean {
  const job = people.mind?.jobOf(person);
  if (!job || !people.mind) return false;
  const site = given !== NOWHERE ? given : siteFor(people, person, job);
  if (site === NOWHERE) {
    people.mind.say(job, 'nowhere to work');
    people.idle(person);
    return false;
  }
  people.wonderTile[person] = site;
  people.mind.say(job, 'fetching');
  if (nextWonderStep(people, person)) return true;
  people.idle(person);
  return false;
}

export function siteFor(people: People, person: number, job: Hypothesis): TileIndex {
  const { world, mind } = people;
  if (!mind) return NOWHERE;
  const { items, grid } = world;
  const { floor, plan } = world.structures;
  const needs = mind.chainOf(job).needs;
  const nearest = (x: number, y: number, skip: TileIndex): number => {
    let found = -1;
    let least = Infinity;
    for (let slot = 0; slot < items.used; slot += 1) {
      const tile = items.tile[slot]!;
      if (!needs.has(items.kind[slot]! as ItemType) || tile === skip || floor[tile] === 1 || plan[tile] !== Blueprint.None || isWonderSite(people, tile) || !world.movement.passable(tile)) continue;
      const at = grid.centre(tile);
      const away = Math.hypot(at.x - x, at.y - y);
      if (away < least) {
        least = away;
        found = slot;
      }
    }
    return found;
  };
  const first = nearest(people.posX[person]!, people.posY[person]!, NOWHERE);
  if (first < 0) return siteNear(people, person);
  const firstTile = items.tile[first]!;
  const firstKind = items.kind[first]! as ItemType;
  if (items.tally(firstTile, firstKind) >= (needs.get(firstKind) ?? 1)) return firstTile;
  const at = grid.centre(firstTile);
  const second = nearest(at.x, at.y, firstTile);
  const tile = second >= 0 ? items.tile[second]! : firstTile;
  return world.movement.passable(tile) && !world.structures.hasStructure(tile) ? tile : siteNear(people, person);
}

export function siteNear(people: People, person: number): TileIndex {
  const { world } = people;
  const { grid } = world;
  const here = people.tileOf(person);
  const clear = (tile: TileIndex): boolean => tile !== NOWHERE && world.movement.passable(tile) && !world.structures.hasStructure(tile) && !isWonderSite(people, tile) && world.items.at(tile).length === 0;
  if (clear(here)) return here;
  for (const [dx, dy] of AROUND) {
    const tile = grid.at(grid.columnOf(here) + dx, grid.rowOf(here) + dy);
    if (clear(tile)) return tile;
  }
  return NOWHERE;
}

export function wonderItem(people: People, person: number, kind: ItemType, site: TileIndex): number {
  const { items, grid } = people.world;
  const { floor, plan } = people.world.structures;
  const x = people.posX[person]!;
  const y = people.posY[person]!;
  let found = -1;
  let least = Infinity;
  for (let slot = 0; slot < items.used; slot += 1) {
    if (items.kind[slot] !== kind) continue;
    const tile = items.tile[slot]!;
    if (tile === site || floor[tile] === 1 || plan[tile] !== Blueprint.None || isWonderSite(people, tile) || !people.world.movement.passable(tile)) continue;
    const at = grid.centre(tile);
    const away = Math.hypot(at.x - x, at.y - y);
    if (away < least) {
      least = away;
      found = slot;
    }
  }
  return found;
}

export function nextWonderStep(people: People, person: number): boolean {
  const { mind } = people;
  const job = mind?.jobOf(person);
  if (!mind || !job) return false;
  const site = people.wonderTile[person]!;
  const { items } = people.world;
  const needs = [...mind.chainOf(job).needs];
  const held = people.heldItemType[person]! as ItemType;
  const short = needs.find(([kind, count]) => items.tally(site, kind) < count);

  if (held !== ItemType.None) {
    if (needs.some(([kind, count]) => kind === held && items.tally(site, kind) < count)) {
      people.assign(person, Task.Bring, site, ItemType.None, EntityState.Carrying);
      return true;
    }
    if (!people.dropHeld(person)) return false;
    return nextWonderStep(people, person);
  }
  if (short) {
    const slot = wonderItem(people, person, short[0], site);
    if (slot < 0) {
      mind.say(job, `no ${ITEM_NAMES[short[0]] ?? 'item'} in reach`);
      return false;
    }
    people.assign(person, Task.Pick, items.tile[slot]!, short[0], EntityState.WalkingToItem);
    return true;
  }
  if (people.tileOf(person) !== site) {
    people.assign(person, Task.Wonder, site, ItemType.None, EntityState.WalkingToItem);
    return true;
  }
  beginTry(people, person);
  return true;
}

export function beginTry(people: People, person: number): void {
  const job = people.mind?.jobOf(person);
  if (job) people.mind?.say(job, job.order ? 'working' : 'trying it');
  people.targetX[person] = people.posX[person]!;
  people.targetY[person] = people.posY[person]!;
  people.task[person] = Task.None;
  people.state[person] = EntityState.Wondering;
  people.timer[person] = WONDER_SECONDS;
  people.strikeClock[person] = STRIKE_INTERVAL;
  people.taskTile[person] = people.wonderTile[person]!;
}

export function finishWonder(people: People, person: number): void {
  const { mind } = people;
  const job = mind?.jobOf(person);
  const site = people.wonderTile[person]!;
  if (!mind || !job || site === NOWHERE) return;
  const { items } = people.world;
  const chain = mind.chainOf(job);
  if ([...chain.needs].some(([kind, count]) => items.tally(site, kind) < count)) {
    mind.say(job, 'lost something on the way');
    return;
  }
  for (const [kind, count] of chain.spend) {
    for (let used = 0; used < count; used += 1) {
      const slot = items.find(site, kind);
      if (slot >= 0) items.remove(slot);
    }
  }
  for (const kind of chain.make) items.add(site, kind);
  const result = neuronOf(job.result).id;
  mind.resolve(job, person);
  people.emit('wonder', person, site);
  if (result === 'flame' && !people.knowledge.hasDiscoveredFire) {
    people.knowledge.hasDiscoveredFire = true;
    people.emit('discovery', person, site);
  }
  if (result === 'tool') people.knowledge.hasDiscoveredFlintKnapping = true;
}
