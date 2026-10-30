import type { TileIndex } from '../../sim/grid.ts';
import { AROUND, NOWHERE } from '../../sim/grid.ts';
import { Station } from '../../sim/world.ts';
import { stationOf } from '../../content/stations/index.ts';
import { EntityState } from './states.ts';
import { ARRIVE, BODY_TEMP_RECOVERED, COLLAPSE, DARK_GLOOM, DAY_WAKES, FIRE_SIDE_TILES, HUDDLE_RANGE, SHELTER_REACH_TILES, SLEEPY, SLEEP_ANGLES, Task, WAKES, Walk } from './tuning.ts';
import type { People, LightSpot } from './people.ts';
import { sideOf, nearestFire } from './fireside.ts';

export function shelteredByLight(people: People, person: number): boolean {
  return people.gloom[person]! > DARK_GLOOM && lightFor(people, person) !== null;
}

export function lightFor(people: People, person: number): LightSpot | null {
  return people.surroundings?.lightNear(people.posX[person]!, people.posY[person]!) ?? null;
}

export function wantsSleep(people: People, person: number): boolean {
  const tiredness = people.tiredness[person]!;
  if (tiredness > COLLAPSE) return true;
  return tiredness > SLEEPY && (lightFor(people, person) !== null || shelterFor(people, person) !== null);
}

export function shelterAt(people: People, tile: TileIndex): Station {
  const { world } = people;
  const { built } = world.structures;
  if (stationOf(built[tile]!)?.shelter?.reach === 'tile') return built[tile]!;
  const { grid } = world;
  for (const [dx, dy] of AROUND) {
    const near = built[grid.at(grid.columnOf(tile) + dx, grid.rowOf(tile) + dy)]!;
    if (stationOf(near)?.shelter?.reach === 'adjacent') return near;
  }
  return Station.None;
}

export function slept(people: People, tile: TileIndex, person: number): boolean {
  for (let other = 0; other < people.count; other += 1) {
    if (other === person || people.state[other] !== EntityState.Sleeping) continue;
    if (people.tileAt(people.targetX[other]!, people.targetY[other]!) === tile) return true;
  }
  return false;
}

export function shelterFor(people: People, person: number): { x: number; y: number } | null {
  const { world } = people;
  const x = people.posX[person]!;
  const y = people.posY[person]!;
  let best: { x: number; y: number } | null = null;
  let least = SHELTER_REACH_TILES;
  for (const station of world.structures.stations) {
    const shelter = stationOf(world.structures.built[station]!)?.shelter;
    if (!shelter) continue;
    const at = world.grid.centre(station);
    const away = Math.hypot(at.x - x, at.y - y);
    if (away >= least) continue;
    const spot = shelter.reach === 'tile' ? station : sideOf(people, person, station);
    if (spot === NOWHERE || slept(people, spot, person)) continue;
    least = away;
    best = world.grid.centre(spot);
  }
  return best;
}

export function beginSleep(people: People, person: number): void {
  const { world } = people;
  const x = people.posX[person]!;
  const y = people.posY[person]!;
  const light = lightFor(people, person);
  people.buildTile[person] = NOWHERE;
  people.wonder[person] = -1;
  people.wonderTile[person] = NOWHERE;
  people.task[person] = Task.None;
  people.hauling[person] = 0;
  people.goalTile[person] = NOWHERE;
  people.targetX[person] = x;
  people.targetY[person] = y;
  people.state[person] = EntityState.Sleeping;
  const shelter = shelterFor(people, person);
  if (shelter) {
    people.targetX[person] = shelter.x;
    people.targetY[person] = shelter.y;
    people.heading[person] = 0;
    return;
  }
  if (!light) return;

  const first = person * Math.PI + people.random() * Math.PI;
  for (let attempt = 0; attempt < SLEEP_ANGLES; attempt += 1) {
    const angle = first + (attempt * Math.PI * 2) / SLEEP_ANGLES;
    const spotX = light.x + Math.cos(angle) * light.side;
    const spotY = light.y + Math.sin(angle) * light.side;
    if (!world.movement.passable(people.tileAt(spotX, spotY))) continue;
    people.targetX[person] = spotX;
    people.targetY[person] = spotY;
    people.heading[person] = angle;
    return;
  }
}

export function sleep(people: People, person: number, dt: number): void {
  const tiredness = people.tiredness[person]!;
  if (tiredness <= WAKES || (tiredness <= DAY_WAKES && people.gloom[person]! < DARK_GLOOM * 0.5)) {
    people.idle(person);
    return;
  }

  const away = Math.hypot(people.targetX[person]! - people.posX[person]!, people.targetY[person]! - people.posY[person]!);
  if (away <= ARRIVE) return;

  const heading = people.heading[person]!;
  const walked = people.walk(person, dt);
  if (walked === Walk.Blocked) {
    people.targetX[person] = people.posX[person]!;
    people.targetY[person] = people.posY[person]!;
  }
  if (walked !== Walk.Moving) people.heading[person] = heading;
}

export function isLying(people: People, person: number): boolean {
  return people.state[person] === EntityState.Sleeping && people.moveSpeed[person] === 0;
}

export function beginHuddle(people: People, person: number): void {
  people.buildTile[person] = NOWHERE;
  people.wonder[person] = -1;
  people.wonderTile[person] = NOWHERE;
  people.task[person] = Task.None;
  people.goalTile[person] = NOWHERE;
  people.state[person] = EntityState.Huddling;
}

export function huddle(people: People, person: number, dt: number): void {
  if (people.bodyTemp[person]! >= BODY_TEMP_RECOVERED) {
    people.idle(person);
    return;
  }

  const x = people.posX[person]!;
  const y = people.posY[person]!;
  const fire = nearestFire(people, x, y);

  if (fire !== NOWHERE) {
    const at = people.world.grid.centre(fire);
    const away = Math.hypot(at.x - x, at.y - y);
    if (away <= FIRE_SIDE_TILES + 0.4) return;
    people.targetX[person] = at.x + ((x - at.x) / away) * FIRE_SIDE_TILES;
    people.targetY[person] = at.y + ((y - at.y) / away) * FIRE_SIDE_TILES;
  } else {
    const mate = people.mateOf(person);
    const away = Math.hypot(people.posX[mate]! - x, people.posY[mate]! - y);
    if (away <= HUDDLE_RANGE) return;
    people.targetX[person] = people.posX[mate]!;
    people.targetY[person] = people.posY[mate]!;
  }
  if (people.walk(person, dt) === Walk.Blocked) people.idle(person);
}
