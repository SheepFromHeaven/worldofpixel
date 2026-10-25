import type { Vec2 } from '../geometry.ts';
import type { TileIndex } from '../grid.ts';
import { AROUND, NOWHERE } from '../grid.ts';
import type { Random } from '../rng.ts';
import { prng } from '../rng.ts';
import type { World } from '../world.ts';
import { Blueprint, Cover } from '../world.ts';
import { FEEDS, LOW_FUEL, fuelOf } from '../sources/fuel.ts';
import { ItemType } from './items.ts';
import { findPath, PATH_LIMIT } from './path.ts';
import { scatterStarterItems } from './starter.ts';

export const POPULATION = 2;

export const ADAM = 0;

export const EVE = 1;

export const NOBODY = -1;

export const EntityState = {
  Idle: 0,
  Wander: 1,
  WalkingToItem: 2,
  PickingUp: 3,
  Carrying: 4,
  ExperimentingKnapping: 5,
  Huddling: 6,
  Chopping: 7,
  Lighting: 8,
  Planting: 9,
  Sleeping: 10,
  Drinking: 11,
  Feeding: 12,
} as const;

export type EntityState = (typeof EntityState)[keyof typeof EntityState];

export const Task = { None: 0, Pick: 1, Knap: 2, Bring: 3, Chop: 4, Light: 5, Plant: 6, Drink: 7, Feed: 8 } as const;

export type Task = (typeof Task)[keyof typeof Task];

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

export type PeopleEventKind = 'pickup' | 'drop' | 'strike' | 'fumble' | 'discovery' | 'chop' | 'light' | 'plant' | 'feed' | 'trial';

export interface PeopleEvent {
  kind: PeopleEventKind;
  person: number;
  tile: TileIndex;
}

type Listener = (event: PeopleEvent) => void;

const Walk = { Moving: 0, Arrived: 1, Blocked: 2 } as const;

type Walk = (typeof Walk)[keyof typeof Walk];

export const BASE_SPEED = 1.5;

export const BODY_TEMP_NORMAL = 37;

export const BODY_TEMP_COLD = 35.6;

export const BODY_TEMP_CRITICAL = 34.5;

const BODY_TEMP_RECOVERED = 36.6;

export const BODY_TEMP_FLOOR = 30;

const SKIN_CELSIUS = 33;

const HEAT_LOSS_PER_DEGREE = 0.0012;

const FIRE_GAIN = 0.1;

const HUDDLE_GAIN = 0.03;

const HUDDLE_LOSS_SHARE = 0.2;

const EXERTION_GAIN = 0.004;

const WARM_AIR_GAIN = 0.01;

const WARM_ENOUGH = 0.3;

export const HUDDLE_RANGE = 0.9;

const HUNGER_PER_SECOND = 1 / 4320;

const THIRST_PER_SECOND = 1 / 1440;

const WEARINESS_PER_SECOND = 1 / 1500;

const REST_RECOVERY_PER_SECOND = 1 / 700;

const NEED_EXERTION = 1.8;

const THIRSTY_ABOVE_CELSIUS = 25;

const THIRST_PER_DEGREE = 0.04;

const STAMINA_DRAIN = 0.011;

const STAMINA_REGAIN = 0.05;

const STAMINA_TIRED = 0.35;

const STAMINA_RESTED = 0.25;

const ARRIVE = 0.02;

const MAX_STEP = 0.1;

const MAX_FRAME = 0.6;

const FIRE_SIDE_TILES = 1.7;

const FIRE_SEEK_TILES = 60;

const DARK_GLOOM = 0.5;

const GLOOM_REFRESH_SECONDS = 1;

const LIGHT_LEASH_TILES = 5;

const LIGHT_PULL = 3;

const SLEEPY = 0.6;

const COLLAPSE = 0.92;

const WAKES = 0.08;

const SLEEP_RECOVERY = 3;

const SLEEP_ANGLES = 8;

const THIRSTY_ENOUGH = 0.45;

const THIRSTY_IN_THE_DARK = 0.8;

const QUENCHED = 0.04;

const DRINK_SEEK_TILES = 30;

const DRINK_PER_SECOND = 0.1;

const DRINK_MAX_SECONDS = 20;

const PICK_SECONDS = 0.7;

const CHOP_SECONDS = 2.6;

const TRIAL_SECONDS = 1e9;

export const CAMPFIRE_BRANCHES = 3;

export const RELIGHT_FLINT = 2;

export const PLAN_NEEDS: readonly (readonly (readonly [ItemType, number])[])[] = [
  [],
  [[ItemType.Branch, CAMPFIRE_BRANCHES]],
  [
    [ItemType.Flint, RELIGHT_FLINT],
    [ItemType.DryKindling, 1],
    [ItemType.Branch, 1],
  ],
];

const FEED_NOTICE_TILES = 20;

const FEED_SEEK_TILES = 60;

const FEED_SECONDS = 0.9;

const LIGHT_SECONDS = 1.6;

const PLANT_SECONDS = 1.2;

export const STRIKE_INTERVAL = 0.8;;

const IDLE_SECONDS = [1.5, 5] as const;

const WANDER_CONTINUES = 0.8;

const PERSISTENCE = 0.5;

const COHESION_BIAS = 1.5;

const COHESION_TILES = 10;

const STEP_JITTER = 0.3;

const HAUL_CHANCE = 0.75;

const HAUL_REACH_TILES = 40;

const SETTLE_RADIUS = 6;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export interface PeopleState {
  columns: Record<string, number[]>;
  knowledge: { hasDiscoveredFlintKnapping: boolean; hasDiscoveredFire: boolean };
}

const BUSY: readonly EntityState[] = [
  EntityState.PickingUp,
  EntityState.ExperimentingKnapping,
  EntityState.Chopping,
  EntityState.Lighting,
  EntityState.Planting,
  EntityState.Feeding,
];

export class People {
  readonly count: number;

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
  readonly thirst = new Float32Array(POPULATION).fill(0.2);
  readonly tiredness = new Float32Array(POPULATION).fill(0.1);
  readonly warmth = new Float32Array(POPULATION);

  readonly air = new Float32Array(POPULATION);

  private readonly gloom = new Float32Array(POPULATION);
  private readonly gloomLeft = new Float32Array(POPULATION);
  private surroundings: PeopleEnvironment | null = null;

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

  readonly knowledge = { hasDiscoveredFlintKnapping: false, hasDiscoveredFire: false };

  private readonly random: Random;
  private readonly listeners = new Set<Listener>();

  constructor(
    readonly world: World,
    spawn: Vec2 | null,
  ) {
    this.random = prng(world.seed ^ 0xad4e);
    this.count = spawn ? POPULATION : 0;
    if (!spawn) return;

    const adam = this.settleNear(world.grid.atPoint(spawn));
    const eve = AROUND.map(([dx, dy]) => world.grid.at(world.grid.columnOf(adam) + dx, world.grid.rowOf(adam) + dy)).find(
      (tile) => world.passable(tile),
    );

    this.place(ADAM, adam);
    this.place(EVE, eve ?? adam);
    scatterStarterItems(world, adam, prng(world.seed ^ 0x57a7));
  }

  private columns(): Record<string, ArrayLike<number> & { set(values: ArrayLike<number>): void }> {
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
    };
  }

  snapshot(): PeopleState {
    const columns: Record<string, number[]> = {};
    for (const [name, array] of Object.entries(this.columns())) columns[name] = Array.from(array);
    return { columns, knowledge: { ...this.knowledge } };
  }

  restore(saved: PeopleState): void {
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
      for (let person = 0; person < this.count; person += 1) {
        this.moveSpeed[person] = 0;
        this.think(person, dt);
        this.vitals(person, dt, environment);
      }
    }
  }

  eligible(person: number): boolean {
    const state = this.state[person]!;
    if (BUSY.includes(state as EntityState)) return false;
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

  lighterFor(tile: TileIndex): number {
    return this.nearest(tile, (person) => this.heldItemType[person] === ItemType.Branch);
  }

  planterFor(tile: TileIndex): number {
    return this.nearest(tile, (person) => this.heldItemType[person] === ItemType.Torch);
  }

  private sideOf(person: number, fire: TileIndex): TileIndex {
    const { grid } = this.world;
    const column = grid.columnOf(fire);
    const row = grid.rowOf(fire);
    const x = this.posX[person]!;
    const y = this.posY[person]!;
    let side: TileIndex = NOWHERE;
    let least = Infinity;
    for (const [dx, dy] of AROUND) {
      const next = grid.at(column + dx, row + dy);
      if (!this.world.passable(next)) continue;
      const at = grid.centre(next);
      const away = Math.hypot(at.x - x, at.y - y);
      if (away < least) {
        least = away;
        side = next;
      }
    }
    return side;
  }

  sendToLight(person: number, fire: TileIndex): void {
    this.buildTile[person] = NOWHERE;
    const side = this.sideOf(person, fire);
    if (side !== NOWHERE) this.assign(person, Task.Light, side, ItemType.None, EntityState.WalkingToItem);
  }

  feederFor(fire: TileIndex): number {
    return this.nearest(fire, (person) => FEEDS.includes(this.heldItemType[person]! as ItemType));
  }

  sendToFeed(person: number, fire: TileIndex = this.hungryFire(person, FEED_SEEK_TILES)): boolean {
    if (fire === NOWHERE || !FEEDS.includes(this.heldItemType[person]! as ItemType)) return false;
    const side = this.sideOf(person, fire);
    if (side === NOWHERE) return false;
    this.buildTile[person] = NOWHERE;
    this.assign(person, Task.Feed, side, ItemType.None, EntityState.WalkingToItem);
    return true;
  }

  private hungryFire(person: number, reach: number): TileIndex {
    const { world } = this;
    const x = this.posX[person]!;
    const y = this.posY[person]!;
    let found: TileIndex = NOWHERE;
    let least = reach;
    for (const tile of world.fires) {
      if (world.fuelAt(tile) >= LOW_FUEL) continue;
      const at = world.grid.centre(tile);
      const away = Math.hypot(at.x - x, at.y - y);
      if (away < least) {
        least = away;
        found = tile;
      }
    }
    return found;
  }

  private feeding(): boolean {
    for (let person = 0; person < this.count; person += 1) if (this.task[person] === Task.Feed || this.hauling[person] === 2) return true;
    return false;
  }

  private beginFeed(person: number): boolean {
    if (this.feeding()) return false;
    const fire = this.hungryFire(person, FEED_NOTICE_TILES);
    if (fire === NOWHERE) return false;
    const held = this.heldItemType[person]! as ItemType;
    if (FEEDS.includes(held)) return this.sendToFeed(person, fire);
    if (held !== ItemType.None) return false;

    const { items, grid, floor, plan } = this.world;
    const x = this.posX[person]!;
    const y = this.posY[person]!;
    let found = -1;
    let least = HAUL_REACH_TILES;
    for (let slot = 0; slot < items.used; slot += 1) {
      if (!FEEDS.includes(items.kind[slot]! as ItemType)) continue;
      const tile = items.tile[slot]!;
      if (floor[tile] === 1 || plan[tile] !== Blueprint.None || this.claimed(tile)) continue;
      const at = grid.centre(tile);
      const away = Math.hypot(at.x - x, at.y - y);
      if (away < least) {
        least = away;
        found = slot;
      }
    }
    if (found < 0) return false;
    this.sendToPick(person, items.tile[found]!, items.kind[found]! as ItemType);
    this.hauling[person] = 2;
    return true;
  }

  sendToBuild(person: number, tile: TileIndex): void {
    this.buildTile[person] = tile;
    if (!this.nextBuildStep(person)) this.idle(person);
  }

  abandonPlan(tile: TileIndex): void {
    for (let person = 0; person < this.count; person += 1) {
      if (this.buildTile[person] !== tile) continue;
      this.buildTile[person] = NOWHERE;
      if (this.task[person] === Task.Pick || this.task[person] === Task.Bring) this.idle(person);
    }
  }

  private beginPlanned(person: number): boolean {
    const held = this.heldItemType[person];
    if (held !== ItemType.None && held !== ItemType.Branch) return false;
    const { world } = this;
    const x = this.posX[person]!;
    const y = this.posY[person]!;
    let found: TileIndex = NOWHERE;
    let least = Infinity;
    for (const tile of world.plans) {
      if (this.builderOn(tile)) continue;
      const at = world.grid.centre(tile);
      const away = Math.hypot(at.x - x, at.y - y);
      if (away < least) {
        least = away;
        found = tile;
      }
    }
    if (found === NOWHERE) return false;
    this.buildTile[person] = found;
    if (this.nextBuildStep(person)) return true;
    this.buildTile[person] = NOWHERE;
    return false;
  }

  private builderOn(tile: TileIndex): boolean {
    for (let person = 0; person < this.count; person += 1) if (this.buildTile[person] === tile) return true;
    return false;
  }

  available(kind: ItemType, tile: TileIndex): number {
    const { items, floor } = this.world;
    let found = items.tally(tile, kind);
    for (let slot = 0; slot < items.used; slot += 1) {
      if (items.kind[slot] === kind && items.tile[slot] !== tile && floor[items.tile[slot]!] === 0) found += 1;
    }
    return found;
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

  endAllTrials(): void {
    for (let person = 0; person < this.count; person += 1) this.endTrial(person);
  }

  interrupt(person: number): void {
    this.dropHeld(person);
    this.idle(person);
  }

  private nearest(tile: TileIndex, accept: (person: number) => boolean): number {
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

  private tileAt(x: number, y: number): TileIndex {
    const { grid } = this.world;
    return grid.row(y) * grid.columns + grid.column(x);
  }

  private settleNear(tile: TileIndex): TileIndex {
    const { world } = this;
    const { grid } = world;
    const column = grid.columnOf(tile);
    const row = grid.rowOf(tile);

    for (let ring = 0; ring <= SETTLE_RADIUS; ring += 1) {
      for (let dr = -ring; dr <= ring; dr += 1) {
        for (let dc = -ring; dc <= ring; dc += 1) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          const found = grid.at(column + dc, row + dr);
          if (world.passable(found)) return found;
        }
      }
    }
    return tile;
  }

  private place(person: number, tile: TileIndex): void {
    const at = this.world.grid.centre(tile);
    this.posX[person] = at.x;
    this.posY[person] = at.y;
    this.targetX[person] = at.x;
    this.targetY[person] = at.y;
    this.heading[person] = this.random() * Math.PI * 2;
    this.timer[person] = IDLE_SECONDS[0] + this.random() * (IDLE_SECONDS[1] - IDLE_SECONDS[0]);
  }

  private emit(kind: PeopleEventKind, person: number, tile: TileIndex): void {
    for (const listener of this.listeners) listener({ kind, person, tile });
  }

  private mateOf(person: number): number {
    return person === ADAM ? EVE : ADAM;
  }

  private assign(person: number, task: Task, tile: TileIndex, kind: ItemType, state: EntityState): void {
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

  private idle(person: number): void {
    this.buildTile[person] = NOWHERE;
    this.task[person] = Task.None;
    this.hauling[person] = 0;
    this.state[person] = EntityState.Idle;
    this.goalTile[person] = NOWHERE;
    this.timer[person] = IDLE_SECONDS[0] + this.random() * (IDLE_SECONDS[1] - IDLE_SECONDS[0]);
  }

  private think(person: number, dt: number): void {
    const state = this.state[person]!;
    const temperature = this.bodyTemp[person]!;
    const busy = BUSY.includes(state as EntityState);

    if (state !== EntityState.Huddling && this.warmth[person]! < WARM_ENOUGH) {
      if (temperature < BODY_TEMP_CRITICAL && !busy) {
        this.interrupt(person);
        this.beginHuddle(person);
      } else if (temperature < BODY_TEMP_COLD && (state === EntityState.Idle || state === EntityState.Wander || state === EntityState.Sleeping)) {
        this.beginHuddle(person);
      }
    }

    switch (this.state[person]!) {
      case EntityState.Idle:
        this.rest(person, dt);
        break;
      case EntityState.Wander:
      case EntityState.WalkingToItem:
      case EntityState.Carrying:
        this.travel(person, dt);
        break;
      case EntityState.Huddling:
        this.huddle(person, dt);
        break;
      case EntityState.Sleeping:
        this.sleep(person, dt);
        break;
      default:
        this.work(person, dt);
    }
  }

  private rest(person: number, dt: number): void {
    this.timer[person] = this.timer[person]! - dt;
    if (this.timer[person]! > 0) return;
    if (this.stamina[person]! < STAMINA_RESTED) {
      this.timer[person] = 1;
      return;
    }
    const sheltering = this.gloom[person]! > DARK_GLOOM && this.lightFor(person) !== null;
    if (this.thirst[person]! > (sheltering ? THIRSTY_IN_THE_DARK : THIRSTY_ENOUGH) && this.beginDrink(person)) return;
    if (this.wantsSleep(person)) {
      this.beginSleep(person);
      return;
    }
    if (this.beginFeed(person)) return;
    if (!sheltering && this.beginPlanned(person)) return;
    if (!sheltering && this.random() < HAUL_CHANCE && this.beginHaul(person)) return;
    this.beginWander(person);
  }

  private shoreFor(person: number): TileIndex {
    const { world } = this;
    const { grid } = world;
    const x = this.posX[person]!;
    const y = this.posY[person]!;
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
        if (!world.passable(tile) || world.fire[tile] !== 0) continue;
        if (this.waterBeside(tile) === NOWHERE) continue;
        least = near;
        found = tile;
      }
    }
    return found;
  }

  private waterBeside(tile: TileIndex): TileIndex {
    const { grid } = this.world;
    for (const [dx, dy] of AROUND) {
      const next = grid.at(grid.columnOf(tile) + dx, grid.rowOf(tile) + dy);
      if (this.world.drinkable(next)) return next;
    }
    return NOWHERE;
  }

  private beginDrink(person: number): boolean {
    const shore = this.shoreFor(person);
    if (shore === NOWHERE) return false;
    this.buildTile[person] = NOWHERE;
    this.hauling[person] = 0;
    this.assign(person, Task.Drink, shore, ItemType.None, EntityState.WalkingToItem);
    return true;
  }

  private lightFor(person: number): LightSpot | null {
    return this.surroundings?.lightNear(this.posX[person]!, this.posY[person]!) ?? null;
  }

  private wantsSleep(person: number): boolean {
    const tiredness = this.tiredness[person]!;
    if (tiredness > COLLAPSE) return true;
    return tiredness > SLEEPY && this.lightFor(person) !== null;
  }

  private beginSleep(person: number): void {
    const { world } = this;
    const x = this.posX[person]!;
    const y = this.posY[person]!;
    const light = this.lightFor(person);
    this.buildTile[person] = NOWHERE;
    this.task[person] = Task.None;
    this.hauling[person] = 0;
    this.goalTile[person] = NOWHERE;
    this.targetX[person] = x;
    this.targetY[person] = y;
    this.state[person] = EntityState.Sleeping;
    if (!light) return;

    const first = person * Math.PI + this.random() * Math.PI;
    for (let attempt = 0; attempt < SLEEP_ANGLES; attempt += 1) {
      const angle = first + (attempt * Math.PI * 2) / SLEEP_ANGLES;
      const spotX = light.x + Math.cos(angle) * light.side;
      const spotY = light.y + Math.sin(angle) * light.side;
      if (!world.passable(this.tileAt(spotX, spotY))) continue;
      this.targetX[person] = spotX;
      this.targetY[person] = spotY;
      this.heading[person] = angle;
      return;
    }
  }

  private sleep(person: number, dt: number): void {
    if (this.tiredness[person]! <= WAKES) {
      this.idle(person);
      return;
    }

    const away = Math.hypot(this.targetX[person]! - this.posX[person]!, this.targetY[person]! - this.posY[person]!);
    if (away <= ARRIVE) return;

    const heading = this.heading[person]!;
    const walked = this.walk(person, dt);
    if (walked === Walk.Blocked) {
      this.targetX[person] = this.posX[person]!;
      this.targetY[person] = this.posY[person]!;
    }
    if (walked !== Walk.Moving) this.heading[person] = heading;
  }

  isLying(person: number): boolean {
    return this.state[person] === EntityState.Sleeping && this.moveSpeed[person] === 0;
  }

  private beginHuddle(person: number): void {
    this.buildTile[person] = NOWHERE;
    this.task[person] = Task.None;
    this.goalTile[person] = NOWHERE;
    this.state[person] = EntityState.Huddling;
  }

  private huddle(person: number, dt: number): void {
    if (this.bodyTemp[person]! >= BODY_TEMP_RECOVERED) {
      this.idle(person);
      return;
    }

    const x = this.posX[person]!;
    const y = this.posY[person]!;
    const fire = this.nearestFire(x, y);

    if (fire !== NOWHERE) {
      const at = this.world.grid.centre(fire);
      const away = Math.hypot(at.x - x, at.y - y);
      if (away <= FIRE_SIDE_TILES + 0.4) return;
      this.targetX[person] = at.x + ((x - at.x) / away) * FIRE_SIDE_TILES;
      this.targetY[person] = at.y + ((y - at.y) / away) * FIRE_SIDE_TILES;
    } else {
      const mate = this.mateOf(person);
      const away = Math.hypot(this.posX[mate]! - x, this.posY[mate]! - y);
      if (away <= HUDDLE_RANGE) return;
      this.targetX[person] = this.posX[mate]!;
      this.targetY[person] = this.posY[mate]!;
    }
    if (this.walk(person, dt) === Walk.Blocked) this.idle(person);
  }

  private nearestFire(x: number, y: number): TileIndex {
    const { world } = this;
    let found: TileIndex = NOWHERE;
    let least = FIRE_SEEK_TILES;
    for (const tile of world.fires) {
      const at = world.grid.centre(tile);
      const away = Math.hypot(at.x - x, at.y - y);
      if (away < least) {
        least = away;
        found = tile;
      }
    }
    return found;
  }

  private beginWander(person: number): void {
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

    const dark = this.gloom[person]! > DARK_GLOOM ? this.lightFor(person) : null;
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
        !world.passable(next) || (diagonal && (!world.passable(grid.at(column + dx, row)) || !world.passable(grid.at(column, row + dy))));
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
      const weight = (1 + PERSISTENCE * along + pull * toward) * world.pace(here, next);
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

  private travel(person: number, dt: number): void {
    const walked = this.walk(person, dt);
    if (walked === Walk.Blocked) this.interrupt(person);
    else if (walked === Walk.Arrived) this.arrive(person);
  }

  private arrive(person: number): void {
    const state = this.state[person]!;
    const { world } = this;

    if (state === EntityState.Wander) {
      if (this.random() < WANDER_CONTINUES && this.stamina[person]! >= STAMINA_RESTED) this.beginWander(person);
      else this.idle(person);
      return;
    }

    if (state === EntityState.Carrying) {
      const here = this.tileOf(person);
      if (world.isStorage(here) && !world.storageAccepts(here, this.heldItemType[person]! as ItemType)) {
        if (!this.carryToStorage(person)) this.idle(person);
        return;
      }
      const goal = this.buildTile[person]!;
      if (goal !== NOWHERE && here === goal && this.heldItemType[person] === ItemType.BurningBranch) {
        this.finishCampfire(person, goal);
        return;
      }
      this.dropHeld(person);
      if (goal !== NOWHERE && here === goal && world.plan[goal] === Blueprint.Relight && this.deficit(goal) === ItemType.None) {
        this.finishRelight(person, goal);
        return;
      }
      if (goal !== NOWHERE && this.nextBuildStep(person)) return;
      this.idle(person);
      return;
    }

    const tile = this.taskTile[person]!;
    const task = this.task[person]!;
    this.targetX[person] = this.posX[person]!;
    this.targetY[person] = this.posY[person]!;

    if (task === Task.Pick && world.items.find(tile, this.taskItem[person] as ItemType) >= 0) {
      this.state[person] = EntityState.PickingUp;
      this.timer[person] = PICK_SECONDS;
    } else if (task === Task.Knap) {
      this.state[person] = EntityState.ExperimentingKnapping;
      this.timer[person] = TRIAL_SECONDS;
      this.strikeClock[person] = STRIKE_INTERVAL;
      if (this.world.floorSpace(tile) > 0) this.dropHeld(person);
      this.emit('trial', person, tile);
    } else if (task === Task.Chop && this.heldItemType[person] === ItemType.HandAxe && world.coverOf(tile) === Cover.Tree) {
      this.state[person] = EntityState.Chopping;
      this.timer[person] = CHOP_SECONDS;
      this.strikeClock[person] = STRIKE_INTERVAL;
    } else if (task === Task.Light && this.heldItemType[person] === ItemType.Branch && this.besideFire(tile)) {
      this.state[person] = EntityState.Lighting;
      this.timer[person] = LIGHT_SECONDS;
    } else if (task === Task.Feed && FEEDS.includes(this.heldItemType[person]! as ItemType) && this.fireBeside(tile) !== NOWHERE) {
      this.state[person] = EntityState.Feeding;
      this.timer[person] = FEED_SECONDS;
    } else if (task === Task.Plant && this.heldItemType[person] === ItemType.Torch && world.plantable(tile)) {
      this.state[person] = EntityState.Planting;
      this.timer[person] = PLANT_SECONDS;
    } else if (task === Task.Drink && this.waterBeside(tile) !== NOWHERE) {
      const water = world.grid.centre(this.waterBeside(tile));
      this.heading[person] = Math.atan2(water.y - this.posY[person]!, water.x - this.posX[person]!);
      this.state[person] = EntityState.Drinking;
      this.timer[person] = DRINK_MAX_SECONDS;
    } else {
      this.idle(person);
    }
  }

  private finishDrink(person: number): void {
    this.task[person] = Task.None;
  }

  private fireBeside(tile: TileIndex): TileIndex {
    const { grid } = this.world;
    for (const [dx, dy] of AROUND) {
      const next = grid.at(grid.columnOf(tile) + dx, grid.rowOf(tile) + dy);
      if (this.world.isFire(next)) return next;
    }
    return NOWHERE;
  }

  private besideFire(tile: TileIndex): boolean {
    return this.fireBeside(tile) !== NOWHERE;
  }

  private work(person: number, dt: number): void {
    const state = this.state[person]!;
    this.timer[person] = this.timer[person]! - dt;

    if (state === EntityState.Drinking && this.thirst[person]! <= QUENCHED) {
      this.idle(person);
      return;
    }

    if (state === EntityState.ExperimentingKnapping || state === EntityState.Chopping) {
      this.strikeClock[person] = this.strikeClock[person]! - dt;
      if (this.strikeClock[person]! <= 0) {
        this.strikeClock[person] = STRIKE_INTERVAL;
        this.emit(state === EntityState.Chopping ? 'chop' : 'strike', person, this.taskTile[person]!);
      }
    }
    if (this.timer[person]! > 0) return;

    if (state === EntityState.PickingUp) {
      this.finishPick(person);
      if (this.hauling[person] === 1 && this.carryToStorage(person)) return;
      if (this.hauling[person] === 2 && this.sendToFeed(person)) return;
      if (this.buildTile[person] !== NOWHERE && this.nextBuildStep(person)) return;
    } else if (state === EntityState.ExperimentingKnapping) return;
    else if (state === EntityState.Lighting) this.finishLight(person);
    else if (state === EntityState.Feeding) this.finishFeed(person);
    else if (state === EntityState.Planting) this.finishPlant(person);
    else if (state === EntityState.Drinking) this.finishDrink(person);
    else this.finishChop(person);
    this.idle(person);
  }

  private storageFor(person: number, kind: ItemType): TileIndex {
    const { world } = this;
    const x = this.posX[person]!;
    const y = this.posY[person]!;
    let found: TileIndex = NOWHERE;
    let least = Infinity;

    for (const tile of world.storageTiles) {
      if (!world.storageAccepts(tile, kind)) continue;
      const at = world.grid.centre(tile);
      const away = Math.hypot(at.x - x, at.y - y);
      if (away < least) {
        least = away;
        found = tile;
      }
    }
    return found;
  }

  private nearestItem(person: number, kind: ItemType, besides: TileIndex, floorsToo: boolean): number {
    const { items, grid, floor } = this.world;
    const x = this.posX[person]!;
    const y = this.posY[person]!;
    let found = -1;
    let least = Infinity;
    for (let slot = 0; slot < items.used; slot += 1) {
      if (items.kind[slot] !== kind) continue;
      const tile = items.tile[slot]!;
      if (tile === besides || (!floorsToo && floor[tile] === 1)) continue;
      const at = grid.centre(tile);
      const away = Math.hypot(at.x - x, at.y - y);
      if (away < least) {
        least = away;
        found = slot;
      }
    }
    return found;
  }

  private deficit(site: TileIndex): ItemType {
    for (const [kind, count] of PLAN_NEEDS[this.world.plan[site]!] ?? []) if (this.world.items.tally(site, kind) < count) return kind;
    return ItemType.None;
  }

  private needed(site: TileIndex, kind: ItemType): boolean {
    return (PLAN_NEEDS[this.world.plan[site]!] ?? []).some(([wanted, count]) => wanted === kind && this.world.items.tally(site, kind) < count);
  }

  private nextBuildStep(person: number): boolean {
    const site = this.buildTile[person]!;
    const plan = this.world.plan[site]!;
    if (plan === Blueprint.None) return false;
    const { items } = this.world;
    const held = this.heldItemType[person]! as ItemType;
    const want = this.deficit(site);

    if (held === ItemType.BurningBranch && plan === Blueprint.Campfire && want === ItemType.None) {
      this.assign(person, Task.Bring, site, ItemType.None, EntityState.Carrying);
      return true;
    }
    if (held !== ItemType.None) {
      if (this.needed(site, held)) {
        this.assign(person, Task.Bring, site, ItemType.None, EntityState.Carrying);
        return true;
      }
      if (!this.dropHeld(person)) return false;
      return this.nextBuildStep(person);
    }
    if (want !== ItemType.None) {
      const slot = this.nearestItem(person, want, site, false);
      if (slot < 0) return false;
      this.assign(person, Task.Pick, items.tile[slot]!, want, EntityState.WalkingToItem);
      return true;
    }
    if (plan === Blueprint.Campfire) {
      const slot = this.nearestItem(person, ItemType.BurningBranch, NOWHERE, true);
      if (slot < 0) return false;
      this.assign(person, Task.Pick, items.tile[slot]!, ItemType.BurningBranch, EntityState.WalkingToItem);
      return true;
    }
    this.assign(person, Task.Bring, site, ItemType.None, EntityState.Carrying);
    return true;
  }

  private finishCampfire(person: number, site: TileIndex): void {
    const { world } = this;
    const { items } = world;
    let fuel = 0;
    for (let used = 0; used < CAMPFIRE_BRANCHES; used += 1) {
      const slot = items.find(site, ItemType.Branch);
      if (slot < 0) continue;
      fuel += fuelOf(ItemType.Branch);
      items.remove(slot);
    }
    this.heldItemType[person] = ItemType.None;
    this.buildTile[person] = NOWHERE;
    if (world.kindle(site, fuel) && !this.knowledge.hasDiscoveredFire) {
      this.knowledge.hasDiscoveredFire = true;
      this.emit('discovery', person, site);
    }
    this.idle(person);
  }

  private finishRelight(person: number, site: TileIndex): void {
    const { world } = this;
    const { items } = world;
    let fuel = 0;
    for (const kind of [ItemType.DryKindling, ItemType.Branch]) {
      const slot = items.find(site, kind);
      if (slot < 0) continue;
      fuel += fuelOf(kind);
      items.remove(slot);
    }
    const spot = this.sideOf(person, site);
    for (let struck = 0; struck < RELIGHT_FLINT; struck += 1) {
      const slot = items.find(site, ItemType.Flint);
      if (slot < 0) break;
      items.remove(slot);
      if (spot !== NOWHERE) items.add(spot, ItemType.Flint);
    }
    this.buildTile[person] = NOWHERE;
    world.kindle(site, fuel);
    this.idle(person);
  }

  private carryToStorage(person: number): boolean {
    const carried = this.heldItemType[person];
    if (carried === ItemType.None || carried === ItemType.HandAxe || carried === ItemType.BurningBranch) return false;
    const tile = this.storageFor(person, this.heldItemType[person]! as ItemType);
    if (tile === NOWHERE) return false;

    this.sendToBring(person, tile);
    return true;
  }

  private beginHaul(person: number): boolean {
    const { world } = this;
    if (world.storageTiles.length === 0) return false;
    if (this.heldItemType[person] !== ItemType.None) return this.carryToStorage(person);
    const { items, grid } = world;
    const stocked = new Map<number, boolean>();
    const x = this.posX[person]!;
    const y = this.posY[person]!;
    let found = -1;
    let least = HAUL_REACH_TILES;

    for (let slot = 0; slot < items.used; slot += 1) {
      const kind = items.kind[slot]!;
      if (kind === ItemType.None || kind === ItemType.HandAxe || kind === ItemType.BurningBranch) continue;

      const tile = items.tile[slot]!;
      if (world.storage[tile] === 1 || world.floor[tile] === 1 || world.plan[tile] !== Blueprint.None || items.at(tile).length !== 1 || !world.passable(tile) || this.claimed(tile)) continue;
      if (!stocked.has(kind)) stocked.set(kind, this.storageFor(person, kind as ItemType) !== NOWHERE);
      if (!stocked.get(kind)) continue;

      const at = grid.centre(tile);
      const away = Math.hypot(at.x - x, at.y - y);
      if (away < least) {
        least = away;
        found = slot;
      }
    }
    if (found < 0) return false;

    this.sendToPick(person, items.tile[found]!, items.kind[found]! as ItemType);
    this.hauling[person] = 1;
    return true;
  }

  private claimed(tile: TileIndex): boolean {
    for (let person = 0; person < this.count; person += 1) if (this.task[person] !== Task.None && this.taskTile[person] === tile) return true;
    return false;
  }

  private finishPick(person: number): void {
    const { items } = this.world;
    const tile = this.taskTile[person]!;
    const slot = items.find(tile, this.taskItem[person] as ItemType);
    if (slot < 0 || this.heldItemType[person] !== ItemType.None) return;

    this.heldItemType[person] = items.kind[slot]!;
    items.remove(slot);
    this.emit('pickup', person, tile);
  }

  private finishChop(person: number): void {
    const tile = this.taskTile[person]!;
    if (!this.world.fell(tile)) return;

    this.world.items.add(tile, ItemType.Branch);
    this.emit('chop', person, tile);
  }

  private finishFeed(person: number): void {
    const fire = this.fireBeside(this.taskTile[person]!);
    const held = this.heldItemType[person]! as ItemType;
    if (fire === NOWHERE || !FEEDS.includes(held) || !this.world.stoke(fire, fuelOf(held))) return;
    this.heldItemType[person] = ItemType.None;
    this.emit('feed', person, fire);
  }

  private finishLight(person: number): void {
    if (this.heldItemType[person] !== ItemType.Branch) return;
    this.heldItemType[person] = ItemType.Torch;
    this.emit('light', person, this.taskTile[person]!);
  }

  private finishPlant(person: number): void {
    const tile = this.taskTile[person]!;
    if (this.heldItemType[person] !== ItemType.Torch || !this.world.plant(tile)) return;
    this.heldItemType[person] = ItemType.None;
    this.emit('plant', person, tile);
  }

  private plan(person: number, goal: TileIndex): void {
    this.goalTile[person] = goal;
    this.pathCursor[person] = 0;
    this.pathLength[person] = findPath(this.world, this.tileOf(person), goal, this.pathTiles, person * PATH_LIMIT);
  }

  private walk(person: number, dt: number): Walk {
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
    const speed = BASE_SPEED * Math.max(world.pace(here, ahead), 0.2) * tired * chilled;
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
        world.tread(ahead);
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

  private vitals(person: number, dt: number, environment: PeopleEnvironment): void {
    const x = this.posX[person]!;
    const y = this.posY[person]!;
    const ambient = environment.temperatureAt(this.tileAt(x, y));
    const heat = environment.warmthAt(x, y);
    this.warmth[person] = heat;
    this.air[person] = ambient;
    this.gloomLeft[person] = this.gloomLeft[person]! - dt;
    if (this.gloomLeft[person]! <= 0) {
      this.gloomLeft[person] = GLOOM_REFRESH_SECONDS;
      this.gloom[person] = environment.gloomAt(x, y);
    }

    const moving = this.moveSpeed[person]! > 0;
    const state = this.state[person]!;
    const resting = state === EntityState.Idle || state === EntityState.Huddling || state === EntityState.Sleeping;
    const sleeping = state === EntityState.Sleeping && !moving;
    if (moving) this.stamina[person] = Math.max(0, this.stamina[person]! - STAMINA_DRAIN * dt);
    else this.stamina[person] = Math.min(1, this.stamina[person]! + STAMINA_REGAIN * (resting ? 1 : 0.5) * dt);

    const exertion = moving ? NEED_EXERTION : 1;
    const dry = 1 + Math.max(0, ambient - THIRSTY_ABOVE_CELSIUS) * THIRST_PER_DEGREE;
    this.hunger[person] = clamp01(this.hunger[person]! + HUNGER_PER_SECOND * exertion * dt);
    this.thirst[person] = clamp01(
      this.thirst[person]! + (state === EntityState.Drinking ? -DRINK_PER_SECOND : THIRST_PER_SECOND * exertion * dry) * dt,
    );
    this.tiredness[person] = clamp01(this.tiredness[person]! + (resting ? -REST_RECOVERY_PER_SECOND * (sleeping ? SLEEP_RECOVERY : 1) : WEARINESS_PER_SECOND * exertion) * dt);

    const mate = this.mateOf(person);
    const close = Math.hypot(this.posX[mate]! - x, this.posY[mate]! - y) <= HUDDLE_RANGE;
    const huddled = close && (state === EntityState.Huddling || this.state[mate] === EntityState.Huddling);

    const loss = Math.max(0, SKIN_CELSIUS - ambient) * HEAT_LOSS_PER_DEGREE * (huddled ? HUDDLE_LOSS_SHARE : 1);
    const gain =
      heat * FIRE_GAIN + (huddled ? HUDDLE_GAIN : 0) + (moving ? EXERTION_GAIN : 0) + (ambient >= SKIN_CELSIUS ? WARM_AIR_GAIN : 0);

    const next = this.bodyTemp[person]! + (gain - loss) * dt;
    this.bodyTemp[person] = Math.min(BODY_TEMP_NORMAL, Math.max(BODY_TEMP_FLOOR, next));
  }
}
