import type { Bounds, Vec2 } from './geometry.ts';
import type { TileGrid, TileIndex } from './grid.ts';
import { NOWHERE } from './grid.ts';
import { Tile } from './tile.ts';
import { Biome } from './types.ts';
import type { WorldField } from './terrain/worldfield.ts';
import { fieldFor, gapTo, isWater } from './terrain/worldfield.ts';
import { coverFor } from './cover.ts';
import { ecoFor } from './eco.ts';
import { Flora } from './flora.ts';
import type { ItemType } from './people/items.ts';
import { GroundItems } from './people/groundItems.ts';
import { BURN_PER_SECOND, FUEL_CAPACITY, FULL_FLAME_FUEL } from './sources/fuel.ts';
import { SEA_LEVEL } from './terrain/heightmap.ts';

export const Cover = {
  Bare: 0,
  Grass: 1,
  Scrub: 2,
  Bush: 3,
  Tree: 4,
  Boulder: 5,
  Fallen: 6,
} as const;

export type Cover = (typeof Cover)[keyof typeof Cover];

export const COVER_NAMES: readonly string[] = [
  'bare ground',
  'grass',
  'scrub',
  'a bush',
  'a tree',
  'a boulder',
  'a fallen tree',
];

const BIOME_PACE: readonly number[] = [1, 0.8, 0.7, 0.55, 0.75, 0.7, 0, 0, 0];

const COVER_PACE: readonly number[] = [1, 1, 0.8, 0.6, 0.7, 0, 0.8];

const STEEPEST_STEP = 0.015;

const CLIMB_PENALTY = 0.3;

const DESCENT_PENALTY = 0.1;

const ALTITUDE_PENALTY = 0.35;

const TRODDEN_BONUS = 0.25;

const BANK_TILES = 0.4;

const SLOWEST_PACE = 0.2;

const FASTEST_PACE = 1.15;

export const WEAR_FULL = 255;

export const STORAGE_CAPACITY = 32;

export const FLOOR_CAPACITY = 12;

const FADE_BAND = 1 << 16;

const FADE_SWEEP_DAYS = 0.25;

const PATH_WEAR = 64;

export const BLOCK_TILES = 64;

function riverTiles(field: WorldField): Uint8Array {
  const { grid } = field;
  const wet = new Uint8Array(grid.count);

  for (const segment of field.rivers.segments) {
    const reach = segment.half + BANK_TILES;
    const first = grid.column(Math.min(segment.ax, segment.bx) - reach);
    const last = grid.column(Math.max(segment.ax, segment.bx) + reach);
    const top = grid.row(Math.min(segment.ay, segment.by) - reach);
    const bottom = grid.row(Math.max(segment.ay, segment.by) + reach);

    for (let row = top; row <= bottom; row += 1) {
      for (let column = first; column <= last; column += 1) {
        if (gapTo(segment, grid.x(column), grid.y(row)) <= reach * reach) wet[row * grid.columns + column] = 1;
      }
    }
  }
  return wet;
}

export const Blueprint = { None: 0, Campfire: 1, Relight: 2 } as const;

export interface WorldState {
  cover: number[];
  wear: number[];
  storage: number[];
  floors?: number[];
  fires: number[];
  plans?: number[];
  relights?: number[];
  fuels?: number[];
  embers?: number[];
  torches?: number[];
  items: number[][];
}

export class World {
  readonly seed: number;
  readonly grid: TileGrid;
  readonly field: WorldField;

  readonly biome: Uint8Array;
  readonly cover: Uint8Array;
  readonly wear: Uint8Array;
  private readonly origin: Uint8Array;
  readonly wind: Uint8Array;
  readonly river: Uint8Array;
  readonly eco: Uint8Array;
  readonly damp: Uint8Array;
  readonly storage: Uint8Array;
  readonly storageTiles: TileIndex[] = [];
  readonly floor: Uint8Array;
  readonly floors: TileIndex[] = [];
  readonly fire: Uint8Array;
  readonly fires: TileIndex[] = [];
  readonly fuel = new Map<TileIndex, number>();
  readonly ember: Uint8Array;
  readonly embers: TileIndex[] = [];
  readonly torch: Uint8Array;
  readonly torches: TileIndex[] = [];
  readonly plan: Uint8Array;
  readonly plans: TileIndex[] = [];
  confinement: { column: number; row: number; radius: number } | null = null;

  readonly items = new GroundItems();
  readonly flora = new Flora();

  readonly stamps: Uint32Array;
  readonly blockColumns: number;

  revision = 0;

  private fading = 0;
  private fadeOwed = 0;

  private constructor(seed: number, field: WorldField) {
    this.seed = seed;
    this.field = field;
    this.grid = field.grid;
    this.biome = field.biome;
    this.wind = field.wind;
    this.wear = new Uint8Array(field.grid.count);
    this.river = riverTiles(field);
    const ground = ecoFor(seed, field, this.river);
    this.eco = ground.eco;
    this.damp = ground.damp;
    this.cover = coverFor(seed, field, this.eco);
    this.origin = this.cover.slice();
    this.storage = new Uint8Array(field.grid.count);
    this.floor = new Uint8Array(field.grid.count);
    this.fire = new Uint8Array(field.grid.count);
    this.ember = new Uint8Array(field.grid.count);
    this.torch = new Uint8Array(field.grid.count);
    this.plan = new Uint8Array(field.grid.count);

    this.blockColumns = Math.ceil(field.grid.columns / BLOCK_TILES);
    this.stamps = new Uint32Array(this.blockColumns * Math.ceil(field.grid.rows / BLOCK_TILES));
  }

  static generate(seed: number): World {
    return new World(seed, fieldFor(seed));
  }

  get count(): number {
    return this.grid.count;
  }

  tile(index: TileIndex): Tile {
    return new Tile(this, index);
  }

  tileAt(point: Vec2): Tile {
    return new Tile(this, this.grid.atPoint(point));
  }

  biomeOf(index: TileIndex): Biome {
    return this.biome[index] as Biome;
  }

  elevationOf(index: TileIndex): number {
    return this.field.height[index]!;
  }

  coverOf(index: TileIndex): Cover {
    return this.cover[index] as Cover;
  }

  wearOf(index: TileIndex): number {
    return this.wear[index]!;
  }

  walkable(index: TileIndex): boolean {
    if (index === NOWHERE) return false;
    return !isWater(this.biome[index] as Biome);
  }

  drinkable(index: TileIndex): boolean {
    if (index === NOWHERE) return false;
    return this.river[index] !== 0 || this.biome[index] === Biome.Lake;
  }

  passable(index: TileIndex): boolean {
    if (index === NOWHERE || this.river[index] !== 0 || this.fire[index] !== 0) return false;
    if (this.confinement && !this.withinConfinement(index)) return false;
    return BIOME_PACE[this.biome[index]!]! > 0 && COVER_PACE[this.cover[index]!]! > 0;
  }

  pace(from: TileIndex, to: TileIndex): number {
    if (!this.passable(to)) return 0;
    const ground = BIOME_PACE[this.biome[to]!]! * COVER_PACE[this.cover[to]!]!;

    const { height } = this.field;
    const rise = (height[to]! - height[from]!) / STEEPEST_STEP;
    const slope = 1 - (rise > 0 ? CLIMB_PENALTY * Math.min(1, rise) : DESCENT_PENALTY * Math.min(1, -rise));
    const thin = 1 - ALTITUDE_PENALTY * Math.max(0, (height[to]! - SEA_LEVEL) / (1 - SEA_LEVEL));
    const trodden = 1 + (this.wear[to]! / WEAR_FULL) * TRODDEN_BONUS;

    return Math.min(FASTEST_PACE, Math.max(SLOWEST_PACE, ground * slope * thin * trodden));
  }

  tread(index: TileIndex, steps = 1): void {
    const worn = this.wear[index]!;
    const capped = Math.min(WEAR_FULL, worn + steps);
    this.wear[index] = capped;
    const cover = this.cover[index]!;
    if (capped >= PATH_WEAR && (cover === Cover.Grass || cover === Cover.Scrub)) this.cover[index] = Cover.Bare;
    if (capped >> 4 !== worn >> 4 || this.cover[index] !== cover) this.touch(index);
  }

  confine(centre: TileIndex, radius: number): void {
    this.confinement = { column: this.grid.columnOf(centre), row: this.grid.rowOf(centre), radius };
  }

  unconfine(): void {
    this.confinement = null;
  }

  private withinConfinement(index: TileIndex): boolean {
    const { confinement, grid } = this;
    if (!confinement) return true;
    return Math.hypot(grid.columnOf(index) - confinement.column, grid.rowOf(index) - confinement.row) <= confinement.radius;
  }

  snapshot(): WorldState {
    const cover: number[] = [];
    const wear: number[] = [];
    for (let i = 0; i < this.cover.length; i += 1) {
      if (this.cover[i] !== this.origin[i]) cover.push(i, this.cover[i]!);
      if (this.wear[i] !== 0) wear.push(i, this.wear[i]!);
    }
    return {
      cover,
      wear,
      storage: [...this.storageTiles],
      floors: [...this.floors],
      fires: [...this.fires],
      fuels: this.fires.map((tile) => this.fuel.get(tile) ?? 0),
      embers: [...this.embers],
      plans: [...this.plans],
      relights: this.plans.filter((tile) => this.plan[tile] === Blueprint.Relight),
      torches: [...this.torches],
      items: this.items.state(),
    };
  }

  restore(saved: WorldState): void {
    for (let i = 0; i + 1 < saved.cover.length; i += 2) this.cover[saved.cover[i]!] = saved.cover[i + 1]!;
    for (let i = 0; i + 1 < saved.wear.length; i += 2) this.wear[saved.wear[i]!] = saved.wear[i + 1]!;
    for (const tile of saved.storage) {
      this.storage[tile] = 1;
      this.storageTiles.push(tile);
    }
    for (const tile of saved.floors ?? []) {
      this.floor[tile] = 1;
      this.floors.push(tile);
    }
    saved.fires.forEach((tile, at) => {
      this.fire[tile] = 1;
      this.fires.push(tile);
      this.fuel.set(tile, saved.fuels?.[at] ?? FULL_FLAME_FUEL);
    });
    for (const tile of saved.embers ?? []) {
      this.ember[tile] = 1;
      this.embers.push(tile);
    }
    for (const tile of saved.plans ?? []) {
      this.plan[tile] = saved.relights?.includes(tile) ? Blueprint.Relight : Blueprint.Campfire;
      this.plans.push(tile);
    }
    for (const tile of saved.torches ?? []) {
      this.torch[tile] = 1;
      this.torches.push(tile);
    }
    this.items.restore(saved.items);
    for (let block = 0; block < this.stamps.length; block += 1) this.stamps[block] = this.stamps[block]! + 1;
    this.revision += 1;
  }

  isFire(index: TileIndex): boolean {
    return index !== NOWHERE && this.fire[index] === 1;
  }

  isEmber(index: TileIndex): boolean {
    return index !== NOWHERE && this.ember[index] === 1;
  }

  fuelAt(index: TileIndex): number {
    return this.fuel.get(index) ?? 0;
  }

  stoke(index: TileIndex, amount: number): boolean {
    if (!this.isFire(index)) return false;
    this.fuel.set(index, Math.min(FUEL_CAPACITY, this.fuelAt(index) + amount));
    return true;
  }

  burn(seconds: number): void {
    for (let at = this.fires.length - 1; at >= 0; at -= 1) {
      const tile = this.fires[at]!;
      const left = this.fuelAt(tile) - seconds * BURN_PER_SECOND;
      if (left > 0) this.fuel.set(tile, left);
      else this.burnOut(tile);
    }
  }

  private burnOut(index: TileIndex): void {
    this.fire[index] = 0;
    this.fires.splice(this.fires.indexOf(index), 1);
    this.fuel.delete(index);
    this.ember[index] = 1;
    this.embers.push(index);
    this.touch(index);
  }

  kindle(index: TileIndex, fuel: number = FULL_FLAME_FUEL): boolean {
    if (index === NOWHERE || this.fire[index] === 1 || this.cover[index] === Cover.Tree) return false;
    if (this.ember[index] === 1) {
      this.ember[index] = 0;
      this.embers.splice(this.embers.indexOf(index), 1);
    }
    if (this.storage[index] === 1) this.release(index);
    if (this.floor[index] === 1) this.unfloor(index);
    this.unplan(index);
    this.fire[index] = 1;
    this.fires.push(index);
    this.fuel.set(index, Math.min(FUEL_CAPACITY, fuel));
    this.cover[index] = Cover.Bare;
    this.wear[index] = WEAR_FULL;
    this.touch(index);
    return true;
  }

  hasStructure(index: TileIndex): boolean {
    if (index === NOWHERE) return false;
    return this.plan[index] !== Blueprint.None || this.fire[index] === 1 || this.ember[index] === 1 || this.storage[index] === 1 || this.floor[index] === 1 || this.torch[index] === 1;
  }

  isPlanned(index: TileIndex): boolean {
    return index !== NOWHERE && this.plan[index] !== Blueprint.None;
  }

  planCampfire(index: TileIndex): boolean {
    if (!this.passable(index) || this.cover[index] === Cover.Tree || this.fire[index] === 1 || this.ember[index] === 1 || this.storage[index] === 1 || this.plan[index] !== Blueprint.None) return false;
    this.plan[index] = Blueprint.Campfire;
    this.plans.push(index);
    this.touch(index);
    return true;
  }

  planRelight(index: TileIndex): boolean {
    if (this.ember[index] !== 1 || this.plan[index] !== Blueprint.None) return false;
    this.plan[index] = Blueprint.Relight;
    this.plans.push(index);
    this.touch(index);
    return true;
  }

  unplan(index: TileIndex): boolean {
    if (this.plan[index] === Blueprint.None) return false;
    this.plan[index] = Blueprint.None;
    this.plans.splice(this.plans.indexOf(index), 1);
    this.touch(index);
    return true;
  }

  plantable(index: TileIndex): boolean {
    return this.passable(index) && this.torch[index] === 0 && this.cover[index] !== Cover.Tree;
  }

  plant(index: TileIndex): boolean {
    if (index === NOWHERE || !this.plantable(index)) return false;
    this.torch[index] = 1;
    this.torches.push(index);
    this.touch(index);
    return true;
  }

  isStorage(index: TileIndex): boolean {
    return index !== NOWHERE && this.storage[index] === 1;
  }

  storageAccepts(index: TileIndex, kind: ItemType): boolean {
    if (!this.isStorage(index)) return false;
    const stack = this.items.at(index);
    return stack.length < STORAGE_CAPACITY && (stack.length === 0 || this.items.kind[stack[0]!] === kind);
  }

  designate(index: TileIndex): boolean {
    if (!this.passable(index) || this.storage[index] === 1 || this.floor[index] === 1 || this.ember[index] === 1 || this.plan[index] !== Blueprint.None) return false;
    this.storage[index] = 1;
    this.storageTiles.push(index);
    this.wear[index] = WEAR_FULL;
    this.touch(index);
    return true;
  }

  release(index: TileIndex): boolean {
    if (this.storage[index] !== 1) return false;
    this.storage[index] = 0;
    this.storageTiles.splice(this.storageTiles.indexOf(index), 1);
    this.touch(index);
    return true;
  }

  isFloor(index: TileIndex): boolean {
    return index !== NOWHERE && this.floor[index] === 1;
  }

  floorSpace(index: TileIndex): number {
    return this.isFloor(index) ? Math.max(0, FLOOR_CAPACITY - this.items.at(index).length) : 0;
  }

  layFloor(index: TileIndex): boolean {
    if (!this.passable(index) || this.floor[index] === 1 || this.storage[index] === 1 || this.ember[index] === 1 || this.plan[index] !== Blueprint.None) return false;
    this.floor[index] = 1;
    this.floors.push(index);
    this.wear[index] = WEAR_FULL;
    this.touch(index);
    return true;
  }

  unfloor(index: TileIndex): boolean {
    if (this.floor[index] !== 1) return false;
    this.floor[index] = 0;
    this.floors.splice(this.floors.indexOf(index), 1);
    this.touch(index);
    return true;
  }

  fell(index: TileIndex): boolean {
    if (this.cover[index] !== Cover.Tree) return false;
    this.cover[index] = Cover.Fallen;
    this.touch(index);
    return true;
  }

  sow(index: TileIndex, cover: Cover): void {
    if (this.cover[index] === cover) return;
    if (this.cover[index] === this.origin[index]) this.origin[index] = cover;
    this.cover[index] = cover;
    this.touch(index);
  }

  grow(days: number): void {
    this.flora.advance(this, days);
  }

  clear(index: TileIndex): void {
    if (this.cover[index] === Cover.Bare) return;
    this.cover[index] = Cover.Bare;
    this.touch(index);
  }

  touch(index: TileIndex): void {
    const block =
      ((this.grid.rowOf(index) / BLOCK_TILES) | 0) * this.blockColumns +
      ((this.grid.columnOf(index) / BLOCK_TILES) | 0);
    this.stamps[block] = this.stamps[block]! + 1;
    this.revision += 1;
  }

  stampOver(bounds: Bounds): number {
    const { grid } = this;
    const first = (grid.column(bounds.minX) / BLOCK_TILES) | 0;
    const last = (grid.column(bounds.maxX) / BLOCK_TILES) | 0;
    const top = (grid.row(bounds.minY) / BLOCK_TILES) | 0;
    const bottom = (grid.row(bounds.maxY) / BLOCK_TILES) | 0;

    let hash = 0;
    for (let row = top; row <= bottom; row += 1) {
      for (let column = first; column <= last; column += 1) {
        hash = Math.imul(hash ^ this.stamps[row * this.blockColumns + column]!, 0x01000193) >>> 0;
      }
    }
    return hash;
  }

  fade(days: number): void {
    const { wear } = this;
    this.fadeOwed += (days / FADE_SWEEP_DAYS) * wear.length;
    const budget = Math.min(Math.floor(this.fadeOwed), FADE_BAND);
    if (budget <= 0) return;
    this.fadeOwed = Math.min(this.fadeOwed - budget, FADE_BAND);

    const end = Math.min(wear.length, this.fading + budget);
    for (let i = this.fading; i < end; i += 1) {
      const worn = wear[i]!;
      if (worn === 0 || this.storage[i] === 1 || this.floor[i] === 1 || this.fire[i] === 1 || this.ember[i] === 1 || this.torch[i] === 1) continue;
      wear[i] = worn - 1;
      if (worn - 1 >> 4 !== worn >> 4) this.touch(i);
    }
    this.fading = end >= wear.length ? 0 : end;
  }
}
