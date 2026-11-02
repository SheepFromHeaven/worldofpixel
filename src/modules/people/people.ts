import type { Vec2 } from '../../sim/geometry.ts';
import type { TileIndex } from '../../sim/grid.ts';
import { AROUND, NOWHERE } from '../../sim/grid.ts';
import type { Random } from '../../sim/rng.ts';
import { prng } from '../../sim/rng.ts';
import type { World } from '../../sim/world.ts';
import { Station } from '../construction/api.ts';
import { ItemType } from '../items/api.ts';
import { findPath, PATH_LIMIT } from './path.ts';
import type { Mind } from '../mind/api.ts';
import { BODY_TEMP_COLD, BODY_TEMP_CRITICAL, BODY_TEMP_NORMAL, EntityState } from './states.ts';
export { BODY_TEMP_COLD, BODY_TEMP_CRITICAL, BODY_TEMP_FLOOR, BODY_TEMP_NORMAL, EntityState } from './states.ts';
import { BUBBLE_SLOTS, Bubble, Glyph } from './bubbles.ts';
import { vitals } from './vitals.ts';
import { births, mortality } from './mortality.ts';
import { arrival, carriedHooks, finisher, isBusy, restLadder } from './activities.ts';
import './coreActivities.ts';
import { isWonderSite, nextWonderStep } from './wonder.ts';
import { carryToStorage } from './haul.ts';
import { roasterFor, sendToRoast } from './food.ts';
import { feederFor, hungryFire, lighterFor, nearestFire, sendToFeed, sendToLight } from './fireside.ts';
import { beginHuddle, huddle, isLying, lightFor, shelterAt, shelteredByLight, sleep } from './sleep.ts';
import { ADAM, ARRIVE, BASE_SPEED, COHESION_BIAS, COHESION_TILES, DARK_GLOOM, EVE, ADULT_SECONDS, FEED_SEEK_TILES, FIRST_AGE_SECONDS, FIRST_PEOPLE, lifespanSeconds, IDLE_SECONDS, LIGHT_LEASH_TILES, LIGHT_PULL, MAX_FRAME, MAX_STEP, NOBODY, PERSISTENCE, POPULATION, QUENCHED, SETTLE_RADIUS, STAMINA_RESTED, STAMINA_TIRED, STEP_JITTER, STRIKE_INTERVAL, Task, WANDER_CONTINUES, WARM_ENOUGH, WONDER_URGENT_SECONDS, Walk, SNAG_SECONDS, clamp01 } from './tuning.ts';
export * from './tuning.ts';

export interface PeopleEnvironment {
  temperatureAt(tile: TileIndex): number;
  warmthAt(x: number, y: number): number;
  gloomAt(x: number, y: number): number;
  lightNear(x: number, y: number): LightSpot | null;
}

export interface LightSpot {
  x: number;
  y: number;
  side: number;
}

export type PeopleEventKind = 'pickup' | 'drop' | 'strike' | 'fumble' | 'discovery' | 'chop' | 'light' | 'plant' | 'feed' | 'forage' | 'trial' | 'wonder' | 'death' | 'birth';

export interface PeopleEvent {
  kind: PeopleEventKind;
  person: number;
  tile: TileIndex;
}

type Listener = (event: PeopleEvent) => void;

export interface PeopleFrame {
  count: number;
  columns: Record<string, Float32Array | Int32Array | Uint16Array | Uint8Array>;
  knowledge: { hasDiscoveredFlintKnapping: boolean; hasDiscoveredFire: boolean };
}

export interface PeopleState {
  count: number;
  columns: Record<string, number[]>;
  knowledge: { hasDiscoveredFlintKnapping: boolean; hasDiscoveredFire: boolean };
}

export class People {
  count: number;

  readonly posX = new Float32Array(POPULATION);
  readonly posY = new Float32Array(POPULATION);
  readonly targetX = new Float32Array(POPULATION);
  readonly targetY = new Float32Array(POPULATION);
  readonly moveSpeed = new Float32Array(POPULATION);
  readonly heading = new Float32Array(POPULATION);
  readonly stride = new Float32Array(POPULATION);

  readonly state = new Uint8Array(POPULATION);
  readonly heldItemType = new Uint8Array(POPULATION);

  readonly bodyTemp = new Float32Array(POPULATION).fill(BODY_TEMP_NORMAL);
  readonly stamina = new Float32Array(POPULATION).fill(1);
  readonly hunger = new Float32Array(POPULATION).fill(0.15);
  readonly thirst = new Float32Array(POPULATION).fill(0.05);
  readonly tiredness = new Float32Array(POPULATION).fill(0.1);
  readonly warmth = new Float32Array(POPULATION);

  readonly air = new Float32Array(POPULATION);

  readonly gloom = new Float32Array(POPULATION);
  readonly gloomLeft = new Float32Array(POPULATION);
  surroundings: PeopleEnvironment | null = null;

  readonly timer = new Float32Array(POPULATION);
  readonly strikeClock = new Float32Array(POPULATION);
  readonly task = new Uint8Array(POPULATION);
  readonly taskTile = new Int32Array(POPULATION).fill(NOWHERE);
  readonly taskItem = new Uint8Array(POPULATION);
  readonly hauling = new Uint8Array(POPULATION);

  readonly goalTile = new Int32Array(POPULATION).fill(NOWHERE);
  readonly buildTile = new Int32Array(POPULATION).fill(NOWHERE);
  readonly pathLength = new Uint16Array(POPULATION);
  readonly pathCursor = new Uint16Array(POPULATION);
  readonly pathTiles = new Int32Array(POPULATION * PATH_LIMIT);
  private readonly scratch = new Int32Array(PATH_LIMIT);
  private readonly snags = new Map<TileIndex, number>();
  private time = 0;

  readonly wonder = new Int32Array(POPULATION).fill(-1);
  readonly wonderTile = new Int32Array(POPULATION).fill(NOWHERE);
  readonly pulse = new Float32Array(POPULATION);
  readonly gathering = new Uint8Array(POPULATION);
  readonly angling = new Uint8Array(POPULATION);
  catchFish: ((x: number, y: number) => boolean) | null = null;
  findFish: ((x: number, y: number) => { x: number; y: number } | null) | null = null;
  readonly roastFire = new Int32Array(POPULATION).fill(NOWHERE);
  readonly bubble = new Uint8Array(POPULATION * BUBBLE_SLOTS);
  readonly curiosity = new Float32Array(POPULATION).fill(0.6);
  readonly dying = new Float32Array(POPULATION);
  readonly female = new Uint8Array(POPULATION);
  readonly age = new Int32Array(POPULATION).fill(FIRST_AGE_SECONDS);
  readonly ageSub = new Float32Array(POPULATION);
  readonly lifespan = new Int32Array(POPULATION);
  readonly kin = new Float32Array(1);

  mind: Mind | null = null;

  readonly knowledge = { hasDiscoveredFlintKnapping: false, hasDiscoveredFire: false };

  readonly random: Random;
  readonly listeners = new Set<Listener>();

  constructor(
    readonly world: World,
    spawn: Vec2 | null,
    present?: number,
  ) {
    this.random = prng(world.seed ^ 0xad4e);
    this.count = present ?? (spawn ? FIRST_PEOPLE : 0);
    const temper = prng(world.seed ^ 0xc0de1);
    for (let person = 0; person < POPULATION; person += 1) this.curiosity[person] = 0.45 + temper() * 0.5;
    const fates = prng(world.seed ^ 0x11fe);
    for (let person = 0; person < POPULATION; person += 1) {
      this.female[person] = person % 2;
      this.lifespan[person] = lifespanSeconds(fates());
    }
    if (!spawn) return;

    const adam = this.settleNear(world.grid.atPoint(spawn));
    const eve = AROUND.map(([dx, dy]) => world.grid.at(world.grid.columnOf(adam) + dx, world.grid.rowOf(adam) + dy)).find(
      (tile) => world.movement.passable(tile),
    );

    this.place(ADAM, adam);
    this.place(EVE, eve ?? adam);
  }

  columns(): Record<string, Float32Array | Int32Array | Uint16Array | Uint8Array> {
    return {
      posX: this.posX,
      posY: this.posY,
      targetX: this.targetX,
      targetY: this.targetY,
      moveSpeed: this.moveSpeed,
      heading: this.heading,
      stride: this.stride,
      state: this.state,
      heldItemType: this.heldItemType,
      bodyTemp: this.bodyTemp,
      stamina: this.stamina,
      hunger: this.hunger,
      thirst: this.thirst,
      tiredness: this.tiredness,
      warmth: this.warmth,
      air: this.air,
      timer: this.timer,
      strikeClock: this.strikeClock,
      task: this.task,
      taskTile: this.taskTile,
      taskItem: this.taskItem,
      hauling: this.hauling,
      goalTile: this.goalTile,
      buildTile: this.buildTile,
      pathLength: this.pathLength,
      pathCursor: this.pathCursor,
      pathTiles: this.pathTiles,
      wonder: this.wonder,
      wonderTile: this.wonderTile,
      pulse: this.pulse,
      gathering: this.gathering,
      angling: this.angling,
      roastFire: this.roastFire,
      bubble: this.bubble,
      curiosity: this.curiosity,
      dying: this.dying,
      female: this.female,
      age: this.age,
      ageSub: this.ageSub,
      lifespan: this.lifespan,
      kin: this.kin,
    };
  }

  pack(): PeopleFrame {
    const columns: Record<string, Float32Array | Int32Array | Uint16Array | Uint8Array> = {};
    for (const [name, array] of Object.entries(this.columns())) if (!name.startsWith('path')) columns[name] = array.slice();
    return { count: this.count, columns, knowledge: { ...this.knowledge } };
  }

  unpack(frame: PeopleFrame): void {
    this.count = frame.count;
    const own = this.columns();
    for (const [name, values] of Object.entries(frame.columns)) own[name]?.set(values);
    this.knowledge.hasDiscoveredFlintKnapping = frame.knowledge.hasDiscoveredFlintKnapping;
    this.knowledge.hasDiscoveredFire = frame.knowledge.hasDiscoveredFire;
  }

  snapshot(): PeopleState {
    const columns: Record<string, number[]> = {};
    for (const [name, array] of Object.entries(this.columns())) columns[name] = Array.from(array);
    return { count: this.count, columns, knowledge: { ...this.knowledge } };
  }

  restore(saved: PeopleState): void {
    this.count = saved.count;
    for (const [name, array] of Object.entries(this.columns())) {
      const values = saved.columns[name];
      if (values && values.length === array.length) array.set(values);
    }
    this.knowledge.hasDiscoveredFlintKnapping = saved.knowledge.hasDiscoveredFlintKnapping;
    this.knowledge.hasDiscoveredFire = saved.knowledge.hasDiscoveredFire;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  tileOf(person: number): TileIndex {
    return this.tileAt(this.posX[person]!, this.posY[person]!);
  }

  update(seconds: number, environment: PeopleEnvironment): void {
    let left = Math.min(seconds, MAX_FRAME);
    this.surroundings = environment;

    while (left > 1e-6) {
      const dt = Math.min(left, MAX_STEP);
      left -= dt;
      this.time += dt;
      for (let person = 0; person < this.count; person += 1) {
        this.moveSpeed[person] = 0;
        if (this.state[person] === EntityState.Dead) continue;
        this.think(person, dt);
        vitals(this, person, dt, environment);
        mortality(this, person, dt);
        this.bubbles(person);
      }
      births(this, dt);
    }
  }

  eligible(person: number): boolean {
    const state = this.state[person]!;
    if (state === EntityState.Dead || isBusy(state)) return false;
    return state !== EntityState.Huddling || this.bodyTemp[person]! >= BODY_TEMP_COLD;
  }

  pickerFor(tile: TileIndex): number {
    return this.nearest(tile, (person) => this.heldItemType[person] === ItemType.None);
  }

  knapperFor(tile: TileIndex): number {
    const empty = this.nearest(tile, (person) => this.heldItemType[person] === ItemType.None);
    return empty !== NOBODY ? empty : this.nearest(tile, () => true);
  }

  builderFor(tile: TileIndex): number {
    return this.nearest(tile, () => true);
  }

  carrierFor(tile: TileIndex): number {
    return this.nearest(tile, (person) => this.heldItemType[person] !== ItemType.None);
  }

  chopperFor(tile: TileIndex): number {
    return this.nearest(tile, (person) => this.heldItemType[person] === ItemType.HandAxe);
  }

  sendToPick(person: number, tile: TileIndex, kind: ItemType): void {
    this.buildTile[person] = NOWHERE;
    this.assign(person, Task.Pick, tile, kind, EntityState.WalkingToItem);
  }

  sendToKnap(person: number, tile: TileIndex): void {
    this.buildTile[person] = NOWHERE;
    this.assign(person, Task.Knap, tile, ItemType.None, EntityState.WalkingToItem);
  }

  sendToBring(person: number, tile: TileIndex): void {
    this.buildTile[person] = NOWHERE;
    this.assign(person, Task.Bring, tile, ItemType.None, EntityState.Carrying);
  }

  planterFor(tile: TileIndex): number {
    return this.nearest(tile, (person) => this.heldItemType[person] === ItemType.Torch);
  }

  sendToPlant(person: number, tile: TileIndex): void {
    this.buildTile[person] = NOWHERE;
    this.assign(person, Task.Plant, tile, ItemType.None, EntityState.WalkingToItem);
  }

  sendToChop(person: number, tile: TileIndex): void {
    this.buildTile[person] = NOWHERE;
    this.assign(person, Task.Chop, tile, ItemType.None, EntityState.WalkingToItem);
  }

  dropHeld(person: number): boolean {
    const kind = this.heldItemType[person]! as ItemType;
    if (kind === ItemType.None) return false;

    const tile = this.tileOf(person);
    if (this.world.items.add(tile, kind) < 0) return false;

    this.heldItemType[person] = ItemType.None;
    this.emit('drop', person, tile);
    return true;
  }

  endTrial(person: number): void {
    if (this.state[person] === EntityState.ExperimentingKnapping) this.idle(person);
  }

  endAllWonders(): void {
    for (let person = 0; person < this.count; person += 1) if (this.wonder[person]! >= 0) this.idle(person);
  }

  endAllTrials(): void {
    for (let person = 0; person < this.count; person += 1) this.endTrial(person);
  }

  interrupt(person: number): void {
    this.dropHeld(person);
    this.idle(person);
  }

  nearest(tile: TileIndex, accept: (person: number) => boolean): number {
    const { grid } = this.world;
    const at = grid.centre(tile);
    let found = NOBODY;
    let least = Infinity;

    for (let person = 0; person < this.count; person += 1) {
      if (!this.eligible(person) || !accept(person)) continue;
      const away = Math.hypot(this.posX[person]! - at.x, this.posY[person]! - at.y);
      if (away < least) {
        least = away;
        found = person;
      }
    }
    return found;
  }

  tileAt(x: number, y: number): TileIndex {
    const { grid } = this.world;
    return grid.row(y) * grid.columns + grid.column(x);
  }

  settleNear(tile: TileIndex): TileIndex {
    const { world } = this;
    const { grid } = world;
    const column = grid.columnOf(tile);
    const row = grid.rowOf(tile);

    for (let ring = 0; ring <= SETTLE_RADIUS; ring += 1) {
      for (let dr = -ring; dr <= ring; dr += 1) {
        for (let dc = -ring; dc <= ring; dc += 1) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          const found = grid.at(column + dc, row + dr);
          if (world.movement.passable(found)) return found;
        }
      }
    }
    return tile;
  }

  place(person: number, tile: TileIndex): void {
    const at = this.world.grid.centre(tile);
    this.posX[person] = at.x;
    this.posY[person] = at.y;
    this.targetX[person] = at.x;
    this.targetY[person] = at.y;
    this.heading[person] = this.random() * Math.PI * 2;
    this.timer[person] = IDLE_SECONDS[0] + this.random() * (IDLE_SECONDS[1] - IDLE_SECONDS[0]);
  }

  emit(kind: PeopleEventKind, person: number, tile: TileIndex): void {
    for (const listener of this.listeners) listener({ kind, person, tile });
  }

  mateOf(person: number): number {
    let found = person;
    let least = Infinity;
    for (let other = 0; other < this.count; other += 1) {
      if (other === person || this.state[other] === EntityState.Dead) continue;
      const away = Math.hypot(this.posX[other]! - this.posX[person]!, this.posY[other]! - this.posY[person]!);
      if (away < least) {
        least = away;
        found = other;
      }
    }
    return found;
  }

  snag(tile: TileIndex): void {
    this.snags.set(tile, this.time + SNAG_SECONDS);
  }

  snagged(tile: TileIndex): boolean {
    const until = this.snags.get(tile);
    if (until === undefined) return false;
    if (until > this.time) return true;
    this.snags.delete(tile);
    return false;
  }

  canReach(person: number, tile: TileIndex): boolean {
    const from = this.tileOf(person);
    return from === tile || findPath(this.world, from, tile, this.scratch, 0) > 0;
  }

  stature(person: number): number {
    return Math.min(1, this.age[person]! / ADULT_SECONDS);
  }

  isAdult(person: number): boolean {
    return this.age[person]! >= ADULT_SECONDS;
  }

  die(person: number): void {
    this.interrupt(person);
    this.state[person] = EntityState.Dead;
    this.moveSpeed[person] = 0;
    this.heldItemType[person] = ItemType.None;
    this.emit('death', person, this.tileOf(person));
  }

  bear(parent: number): void {
    const child = this.count;
    this.count += 1;
    this.female[child] = this.random() < 0.5 ? 1 : 0;
    this.age[child] = 0;
    this.ageSub[child] = 0;
    this.lifespan[child] = lifespanSeconds(this.random());
    this.place(child, this.settleNear(this.tileOf(parent)));
    this.emit('birth', child, this.tileOf(child));
  }

  assign(person: number, task: Task, tile: TileIndex, kind: ItemType, state: EntityState): void {
    const at = this.world.grid.centre(tile);
    this.targetX[person] = at.x;
    this.targetY[person] = at.y;
    this.goalTile[person] = NOWHERE;
    this.task[person] = task;
    this.taskTile[person] = tile;
    this.taskItem[person] = kind;
    this.hauling[person] = 0;
    this.state[person] = state;
  }

  idle(person: number): void {
    this.buildTile[person] = NOWHERE;
    this.wonder[person] = -1;
    this.wonderTile[person] = NOWHERE;
    this.task[person] = Task.None;
    this.hauling[person] = 0;
    this.state[person] = EntityState.Idle;
    this.goalTile[person] = NOWHERE;
    this.timer[person] = IDLE_SECONDS[0] + this.random() * (IDLE_SECONDS[1] - IDLE_SECONDS[0]);
  }

  think(person: number, dt: number): void {
    const state = this.state[person]!;
    const temperature = this.bodyTemp[person]!;
    const busy = isBusy(state);

    if (state !== EntityState.Huddling && this.warmth[person]! < WARM_ENOUGH) {
      if (temperature < BODY_TEMP_CRITICAL && !busy) {
        this.interrupt(person);
        beginHuddle(this, person);
      } else if (temperature < BODY_TEMP_COLD && (state === EntityState.Idle || state === EntityState.Wander || state === EntityState.Sleeping)) {
        beginHuddle(this, person);
      }
    }

    switch (this.state[person]!) {
      case EntityState.Idle:
        this.rest(person, dt);
        break;
      case EntityState.Wander:
        if (this.wonder[person] === -1 && !shelteredByLight(this, person) && this.mind?.urgentFor(person)) {
          this.idle(person);
          this.timer[person] = 0;
          break;
        }
        this.travel(person, dt);
        break;
      case EntityState.WalkingToItem:
      case EntityState.Carrying:
        this.travel(person, dt);
        break;
      case EntityState.Huddling:
        huddle(this, person, dt);
        break;
      case EntityState.Sleeping:
        sleep(this, person, dt);
        break;
      default:
        this.work(person, dt);
    }
  }

  rest(person: number, dt: number): void {
    if (this.timer[person]! > WONDER_URGENT_SECONDS && !shelteredByLight(this, person) && this.mind?.urgentFor(person)) this.timer[person] = WONDER_URGENT_SECONDS;
    this.timer[person] = this.timer[person]! - dt;
    if (this.timer[person]! > 0) return;
    if (this.stamina[person]! < STAMINA_RESTED) {
      this.timer[person] = 1;
      return;
    }
    const context = { sheltering: shelteredByLight(this, person) };
    for (const step of restLadder()) if (step.choose(this, person, context)) return;
    this.beginWander(person);
  }

  setGathering(on: boolean): void {
    this.gathering.fill(on ? 1 : 0);
  }

  setAngling(on: boolean): void {
    this.angling.fill(on ? 1 : 0);
  }

  beginWander(person: number): void {
    const { world } = this;
    const { grid } = world;
    const here = this.tileOf(person);
    const column = grid.columnOf(here);
    const row = grid.rowOf(here);
    const x = this.posX[person]!;
    const y = this.posY[person]!;
    const heading = this.heading[person]!;

    let pullX = 0;
    let pullY = 0;
    let pull = 0;
    const mate = this.mateOf(person);
    const apart = Math.hypot(this.posX[mate]! - x, this.posY[mate]! - y);
    if (apart > COHESION_TILES) {
      pullX = (this.posX[mate]! - x) / apart;
      pullY = (this.posY[mate]! - y) / apart;
      pull = COHESION_BIAS;
    }

    const dark = this.gloom[person]! > DARK_GLOOM ? lightFor(this, person) : null;
    if (dark) {
      const gap = Math.hypot(dark.x - x, dark.y - y);
      if (gap > LIGHT_LEASH_TILES - 1) {
        pullX = (dark.x - x) / gap;
        pullY = (dark.y - y) / gap;
        pull = LIGHT_PULL;
      }
    }

    const weights: number[] = [];
    let total = 0;
    for (const [dx, dy] of AROUND) {
      const next = grid.at(column + dx, row + dy);
      const diagonal = dx !== 0 && dy !== 0;
      const blocked =
        !world.movement.passable(next) || (diagonal && (!world.movement.passable(grid.at(column + dx, row)) || !world.movement.passable(grid.at(column, row + dy))));
      if (blocked) {
        weights.push(0);
        continue;
      }

      if (dark) {
        const after = grid.centre(next);
        const farther = Math.hypot(after.x - dark.x, after.y - dark.y) > LIGHT_LEASH_TILES && Math.hypot(after.x - dark.x, after.y - dark.y) >= Math.hypot(x - dark.x, y - dark.y);
        if (farther) {
          weights.push(0);
          continue;
        }
      }

      const length = Math.hypot(dx, dy);
      const along = Math.max(0, (dx / length) * Math.cos(heading) + (dy / length) * Math.sin(heading));
      const toward = Math.max(0, (dx / length) * pullX + (dy / length) * pullY);
      const weight = (1 + PERSISTENCE * along + pull * toward) * world.movement.pace(here, next);
      weights.push(weight);
      total += weight;
    }

    if (total <= 0) {
      this.idle(person);
      return;
    }

    let roll = this.random() * total;
    let pick = 0;
    for (let direction = 0; direction < weights.length; direction += 1) {
      roll -= weights[direction]!;
      if (roll <= 0) {
        pick = direction;
        break;
      }
    }

    const [dx, dy] = AROUND[pick]!;
    const next = grid.at(column + dx, row + dy);
    const at = grid.centre(next);
    this.targetX[person] = at.x + (this.random() - 0.5) * 2 * STEP_JITTER;
    this.targetY[person] = at.y + (this.random() - 0.5) * 2 * STEP_JITTER;
    this.goalTile[person] = next;
    this.pathTiles[person * PATH_LIMIT] = next;
    this.pathLength[person] = 1;
    this.pathCursor[person] = 0;
    this.task[person] = Task.None;
    this.state[person] = EntityState.Wander;
  }

  travel(person: number, dt: number): void {
    const walked = this.walk(person, dt);
    if (walked === Walk.Blocked) {
      if (this.task[person] !== Task.None && this.taskTile[person] !== NOWHERE) this.snag(this.taskTile[person]!);
      this.interrupt(person);
    } else if (walked === Walk.Arrived) this.arrive(person);
  }

  arrive(person: number): void {
    const state = this.state[person]!;
    const { world } = this;

    if (state === EntityState.Wander) {
      if (this.random() < WANDER_CONTINUES && this.stamina[person]! >= STAMINA_RESTED) this.beginWander(person);
      else this.idle(person);
      return;
    }

    if (state === EntityState.Carrying) {
      const here = this.tileOf(person);
      if (world.structures.isStorage(here) && !world.structures.storageAccepts(here, this.heldItemType[person]! as ItemType)) {
        if (!carryToStorage(this, person)) this.idle(person);
        return;
      }
      for (const hook of carriedHooks()) if (hook.before?.(this, person, here)) return;
      this.dropHeld(person);
      if (this.wonderTile[person] !== NOWHERE) {
        if (!nextWonderStep(this, person)) this.idle(person);
        return;
      }
      for (const hook of carriedHooks()) if (hook.after?.(this, person, here)) return;
      this.idle(person);
      return;
    }

    const tile = this.taskTile[person]!;
    const task = this.task[person]!;
    this.targetX[person] = this.posX[person]!;
    this.targetY[person] = this.posY[person]!;

    if (!arrival(task)?.begin(this, person, tile)) this.idle(person);
  }

  work(person: number, dt: number): void {
    const state = this.state[person]!;
    this.timer[person] = this.timer[person]! - dt;

    if (state === EntityState.Drinking && this.thirst[person]! <= QUENCHED) {
      this.idle(person);
      return;
    }

    if (state === EntityState.ExperimentingKnapping || state === EntityState.Chopping || state === EntityState.Wondering) {
      this.strikeClock[person] = this.strikeClock[person]! - dt;
      if (this.strikeClock[person]! <= 0) {
        this.strikeClock[person] = STRIKE_INTERVAL;
        this.emit(state === EntityState.Chopping ? 'chop' : 'strike', person, this.taskTile[person]!);
      }
    }
    if (this.timer[person]! > 0) return;

    if (finisher(this, person, state)?.finish(this, person)) return;
    this.idle(person);
  }

  say(person: number, kind: Bubble, first: number, second = 0, third = 0): void {
    const at = person * BUBBLE_SLOTS;
    this.bubble[at] = kind;
    this.bubble[at + 1] = first;
    this.bubble[at + 2] = second;
    this.bubble[at + 3] = third;
  }

  bubbles(person: number): void {
    const job = this.mind?.jobOf(person);
    if (this.pulse[person]! > 0.2) this.say(person, Bubble.Thought, Glyph.Bang);
    else if (job && !job.order) this.say(person, Bubble.Thought, Glyph.Query);
    else this.say(person, Bubble.None, Glyph.None);
  }

  plan(person: number, goal: TileIndex): void {
    this.goalTile[person] = goal;
    this.pathCursor[person] = 0;
    this.pathLength[person] = findPath(this.world, this.tileOf(person), goal, this.pathTiles, person * PATH_LIMIT);
  }

  walk(person: number, dt: number): Walk {
    const { world } = this;
    const targetX = this.targetX[person]!;
    const targetY = this.targetY[person]!;
    const goal = this.tileAt(targetX, targetY);
    if (this.goalTile[person] !== goal) this.plan(person, goal);

    const here = this.tileOf(person);
    let cursor = this.pathCursor[person]!;
    const length = this.pathLength[person]!;

    let destX = targetX;
    let destY = targetY;
    let ahead = goal;
    if (cursor < length) {
      ahead = this.pathTiles[person * PATH_LIMIT + cursor]!;
      if (cursor !== length - 1 || ahead !== goal) {
        const centre = world.grid.centre(ahead);
        destX = centre.x;
        destY = centre.y;
      }
    } else if (here !== goal) {
      this.plan(person, goal);
      return this.pathLength[person] === 0 ? Walk.Blocked : Walk.Moving;
    }

    const stamina = this.stamina[person]!;
    const tired = 0.45 + 0.55 * clamp01(stamina / STAMINA_TIRED);
    const chilled = 1 - 0.4 * clamp01((BODY_TEMP_COLD + 0.4 - this.bodyTemp[person]!) / 4);
    const speed = BASE_SPEED * Math.max(world.movement.pace(here, ahead), 0.2) * tired * chilled;
    this.moveSpeed[person] = speed;

    const dx = destX - this.posX[person]!;
    const dy = destY - this.posY[person]!;
    const away = Math.hypot(dx, dy);
    const reach = speed * dt;

    this.stride[person] = this.stride[person]! + Math.min(away, reach);

    if (away <= reach) {
      this.posX[person] = destX;
      this.posY[person] = destY;
      if (cursor < length) {
        world.trails.tread(ahead);
        cursor += 1;
        this.pathCursor[person] = cursor;
      }
    } else {
      this.posX[person] = this.posX[person]! + (dx / away) * reach;
      this.posY[person] = this.posY[person]! + (dy / away) * reach;
    }
    if (away > 1e-4) this.heading[person] = Math.atan2(dy, dx);

    const finished = cursor >= length && Math.hypot(targetX - this.posX[person]!, targetY - this.posY[person]!) < ARRIVE;
    return finished ? Walk.Arrived : Walk.Moving;
  }


  lighterFor(tile: TileIndex): number {
    return lighterFor(this, tile);
  }

  sendToLight(person: number, fire: TileIndex): void {
    return sendToLight(this, person, fire);
  }

  feederFor(fire: TileIndex): number {
    return feederFor(this, fire);
  }

  sendToFeed(person: number, fire: TileIndex = hungryFire(this, person, FEED_SEEK_TILES)): boolean {
    return sendToFeed(this, person, fire);
  }

  roasterFor(fire: TileIndex): number {
    return roasterFor(this, fire);
  }

  sendToRoast(person: number, fire: TileIndex): boolean {
    return sendToRoast(this, person, fire);
  }

  shelterAt(tile: TileIndex): Station {
    return shelterAt(this, tile);
  }

  isLying(person: number): boolean {
    return isLying(this, person);
  }

  nearestFire(x: number, y: number): TileIndex {
    return nearestFire(this, x, y);
  }

  isWonderSite(tile: TileIndex): boolean {
    return isWonderSite(this, tile);
  }
}
