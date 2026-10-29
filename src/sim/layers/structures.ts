import type { TileIndex } from '../grid.ts';
import { NOWHERE } from '../grid.ts';
import { Cover } from '../covers.ts';
import type { ItemType } from '../people/items.ts';
import type { GroundItems } from '../people/groundItems.ts';
import { FUEL_CAPACITY, FULL_FLAME_FUEL, BURN_PER_SECOND } from '../sources/fuel.ts';
import type { Column, Layer, LayerHost } from './layer.ts';
import { packColumns, unpackColumns } from './layer.ts';
import { WEAR_FULL } from './trails.ts';

export const STORAGE_CAPACITY = 32;

export const FLOOR_CAPACITY = 12;

export const Blueprint = { None: 0, Campfire: 1, Relight: 2, Kindle: 3, Bed: 4, Hut: 5, Snare: 6 } as const;

export const Building = { None: 0, Bed: 1, Hut: 2, Snare: 3 } as const;

export type Building = (typeof Building)[keyof typeof Building];

export interface StructuresHost extends LayerHost {
  readonly cover: Uint8Array;
  readonly river: Uint8Array;
  readonly wear: Uint8Array;
  readonly items: GroundItems;
  passable(tile: TileIndex): boolean;
  clearPlants(tile: TileIndex): void;
}

export interface StructureArrays {
  storage: Uint8Array;
  floor: Uint8Array;
  fire: Uint8Array;
  ember: Uint8Array;
  torch: Uint8Array;
  plan: Uint8Array;
  built: Uint8Array;
}

interface Lists {
  storage: number[];
  floors: number[];
  fires: number[];
  embers: number[];
  plans: number[];
  torches: number[];
  depths: number[];
  buildings: number[];
}

interface StructuresDelta {
  columns: Record<string, Column>;
  lists: Lists | null;
  fuel: number[];
}

export interface StructuresState {
  storage: number[];
  floors: number[];
  fires: number[];
  fuels: number[];
  embers: number[];
  plans: [number, number][];
  torches: number[];
  depths: number[];
  buildings: [number, number][];
}

export class Structures implements Layer {
  readonly id = 'structures';
  readonly storage: Uint8Array;
  readonly floor: Uint8Array;
  readonly fire: Uint8Array;
  readonly ember: Uint8Array;
  readonly torch: Uint8Array;
  readonly plan: Uint8Array;
  readonly built: Uint8Array;
  readonly storageTiles: TileIndex[] = [];
  readonly floors: TileIndex[] = [];
  readonly fires: TileIndex[] = [];
  readonly embers: TileIndex[] = [];
  readonly torches: TileIndex[] = [];
  readonly plans: TileIndex[] = [];
  readonly buildings: TileIndex[] = [];
  readonly fuel = new Map<TileIndex, number>();
  readonly torchDepth = new Map<TileIndex, number>();
  private listRevision = 0;
  private sentListRevision = -1;

  constructor(
    arrays: StructureArrays,
    private readonly host: StructuresHost,
  ) {
    ({ storage: this.storage, floor: this.floor, fire: this.fire, ember: this.ember, torch: this.torch, plan: this.plan, built: this.built } = arrays);
  }

  columns(): Record<string, Column> {
    return { storage: this.storage, floor: this.floor, fire: this.fire, ember: this.ember, torch: this.torch, plan: this.plan, built: this.built };
  }

  pack(tiles: Int32Array): StructuresDelta {
    const lists =
      this.sentListRevision === this.listRevision
        ? null
        : {
            storage: [...this.storageTiles],
            floors: [...this.floors],
            fires: [...this.fires],
            embers: [...this.embers],
            plans: [...this.plans],
            torches: [...this.torches],
            depths: this.depthPairs(),
            buildings: [...this.buildings],
          };
    this.sentListRevision = this.listRevision;
    const fuel: number[] = [];
    for (const tile of this.fires) fuel.push(tile, this.fuelAt(tile));
    return { columns: packColumns(tiles, this.columns()), lists, fuel };
  }

  unpack(tiles: Int32Array, delta: unknown): void {
    const { columns, lists, fuel } = delta as StructuresDelta;
    unpackColumns(tiles, this.columns(), columns);
    if (lists) {
      const replace = (target: TileIndex[], source: number[]): void => {
        target.length = 0;
        target.push(...source);
      };
      replace(this.storageTiles, lists.storage);
      replace(this.floors, lists.floors);
      replace(this.fires, lists.fires);
      replace(this.embers, lists.embers);
      replace(this.plans, lists.plans);
      replace(this.torches, lists.torches);
      replace(this.buildings, lists.buildings);
      this.torchDepth.clear();
      for (let at = 0; at + 1 < lists.depths.length; at += 2) this.torchDepth.set(lists.depths[at]!, lists.depths[at + 1]!);
    }
    this.fuel.clear();
    for (let at = 0; at + 1 < fuel.length; at += 2) this.fuel.set(fuel[at]!, fuel[at + 1]!);
  }

  introduce(): void {
    this.listRevision += 1;
  }

  snapshot(): StructuresState {
    return {
      storage: [...this.storageTiles],
      floors: [...this.floors],
      fires: [...this.fires],
      fuels: this.fires.map((tile) => this.fuel.get(tile) ?? 0),
      embers: [...this.embers],
      plans: this.plans.map((tile) => [tile, this.plan[tile]!]),
      torches: [...this.torches],
      depths: this.depthPairs(),
      buildings: this.buildings.map((tile) => [tile, this.built[tile]!]),
    };
  }

  restore(saved: unknown): void {
    const state = saved as StructuresState;
    for (const tile of state.storage) {
      this.storage[tile] = 1;
      this.storageTiles.push(tile);
    }
    for (const tile of state.floors) {
      this.floor[tile] = 1;
      this.floors.push(tile);
    }
    state.fires.forEach((tile, at) => {
      this.fire[tile] = 1;
      this.fires.push(tile);
      this.fuel.set(tile, state.fuels[at] ?? FULL_FLAME_FUEL);
    });
    for (const tile of state.embers) {
      this.ember[tile] = 1;
      this.embers.push(tile);
    }
    for (const [tile, kind] of state.plans) {
      this.plan[tile] = kind;
      this.plans.push(tile);
    }
    for (const [tile, kind] of state.buildings) this.raise(tile, kind as Building);
    for (let at = 0; at + 1 < state.depths.length; at += 2) this.torchDepth.set(state.depths[at]!, state.depths[at + 1]!);
    for (const tile of state.torches) {
      if (!this.torchDepth.has(tile)) this.torch[tile] = 1;
      this.torches.push(tile);
    }
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
    this.listRevision += 1;
    this.fire[index] = 0;
    this.fires.splice(this.fires.indexOf(index), 1);
    this.fuel.delete(index);
    this.ember[index] = 1;
    this.embers.push(index);
    this.host.touch(index);
  }

  extinguish(index: TileIndex): boolean {
    if (this.fire[index] !== 1) return false;
    this.burnOut(index);
    return true;
  }

  clearEmber(index: TileIndex): boolean {
    if (this.ember[index] !== 1) return false;
    this.listRevision += 1;
    this.ember[index] = 0;
    this.embers.splice(this.embers.indexOf(index), 1);
    this.host.touch(index);
    return true;
  }

  pull(index: TileIndex): boolean {
    if (index === NOWHERE || this.torch[index] !== 1) return false;
    this.listRevision += 1;
    this.torch[index] = 0;
    this.torches.splice(this.torches.indexOf(index), 1);
    this.host.touch(index);
    return true;
  }

  kindle(index: TileIndex, fuel: number = FULL_FLAME_FUEL): boolean {
    if (index === NOWHERE || this.fire[index] === 1 || this.host.cover[index] === Cover.Tree || this.built[index] !== Building.None) return false;
    if (this.ember[index] === 1) {
      this.ember[index] = 0;
      this.embers.splice(this.embers.indexOf(index), 1);
    }
    if (this.storage[index] === 1) this.release(index);
    if (this.floor[index] === 1) this.unfloor(index);
    this.unplan(index);
    this.listRevision += 1;
    this.fire[index] = 1;
    this.fires.push(index);
    this.fuel.set(index, Math.min(FUEL_CAPACITY, fuel));
    this.host.clearPlants(index);
    this.host.wear[index] = WEAR_FULL;
    this.host.touch(index);
    return true;
  }

  hasStructure(index: TileIndex): boolean {
    if (index === NOWHERE) return false;
    return this.plan[index] !== Blueprint.None || this.fire[index] === 1 || this.ember[index] === 1 || this.storage[index] === 1 || this.floor[index] === 1 || this.torch[index] === 1 || this.built[index] !== Building.None;
  }

  isPlanned(index: TileIndex): boolean {
    return index !== NOWHERE && this.plan[index] !== Blueprint.None;
  }

  planCampfire(index: TileIndex): boolean {
    if (!this.host.passable(index) || this.host.cover[index] === Cover.Tree || this.fire[index] === 1 || this.ember[index] === 1 || this.storage[index] === 1 || this.built[index] !== Building.None || this.plan[index] !== Blueprint.None) return false;
    this.listRevision += 1;
    this.plan[index] = Blueprint.Campfire;
    this.plans.push(index);
    this.host.touch(index);
    return true;
  }

  planKindle(index: TileIndex): boolean {
    if (!this.planCampfire(index)) return false;
    this.plan[index] = Blueprint.Kindle;
    return true;
  }

  planRelight(index: TileIndex): boolean {
    this.listRevision += 1;
    if (this.ember[index] !== 1 || this.plan[index] !== Blueprint.None) return false;
    this.plan[index] = Blueprint.Relight;
    this.plans.push(index);
    this.host.touch(index);
    return true;
  }

  planBuilding(index: TileIndex, kind: typeof Blueprint.Bed | typeof Blueprint.Hut | typeof Blueprint.Snare): boolean {
    if (!this.host.passable(index) || this.host.cover[index] === Cover.Tree || this.host.river[index] !== 0 || this.fire[index] === 1 || this.ember[index] === 1) return false;
    if (this.storage[index] === 1 || this.floor[index] === 1 || this.torch[index] === 1 || this.built[index] !== Building.None || this.plan[index] !== Blueprint.None) return false;
    this.listRevision += 1;
    this.plan[index] = kind;
    this.plans.push(index);
    this.host.touch(index);
    return true;
  }

  raise(index: TileIndex, kind: Building): boolean {
    if (index === NOWHERE || kind === Building.None || this.built[index] !== Building.None) return false;
    this.unplan(index);
    this.listRevision += 1;
    this.built[index] = kind;
    this.buildings.push(index);
    this.host.clearPlants(index);
    this.host.wear[index] = WEAR_FULL;
    this.host.touch(index);
    return true;
  }

  demolish(index: TileIndex): boolean {
    if (index === NOWHERE || this.built[index] === Building.None) return false;
    this.listRevision += 1;
    this.built[index] = Building.None;
    this.buildings.splice(this.buildings.indexOf(index), 1);
    this.host.touch(index);
    return true;
  }

  isBuilt(index: TileIndex, kind: Building): boolean {
    return index !== NOWHERE && this.built[index] === kind;
  }

  unplan(index: TileIndex): boolean {
    if (this.plan[index] === Blueprint.None) return false;
    this.listRevision += 1;
    this.plan[index] = Blueprint.None;
    this.plans.splice(this.plans.indexOf(index), 1);
    this.host.touch(index);
    return true;
  }

  plantable(index: TileIndex): boolean {
    return this.host.passable(index) && this.torch[index] === 0 && this.host.cover[index] !== Cover.Tree;
  }

  private depthPairs(): number[] {
    const pairs: number[] = [];
    for (const [tile, elevation] of this.torchDepth) pairs.push(tile, elevation);
    return pairs;
  }

  isDeepTorch(index: TileIndex): boolean {
    return this.torchDepth.has(index);
  }

  plant(index: TileIndex, elevation?: number): boolean {
    if (index === NOWHERE) return false;
    this.listRevision += 1;
    if (elevation !== undefined) {
      if (this.torchDepth.has(index)) return false;
      this.torches.push(index);
      this.torchDepth.set(index, elevation);
      return true;
    }
    if (!this.plantable(index)) return false;
    this.torch[index] = 1;
    this.torches.push(index);
    this.host.touch(index);
    return true;
  }

  isStorage(index: TileIndex): boolean {
    return index !== NOWHERE && this.storage[index] === 1;
  }

  storageAccepts(index: TileIndex, kind: ItemType): boolean {
    if (!this.isStorage(index)) return false;
    const stack = this.host.items.at(index);
    return stack.length < STORAGE_CAPACITY && (stack.length === 0 || this.host.items.kind[stack[0]!] === kind);
  }

  designate(index: TileIndex): boolean {
    if (!this.host.passable(index) || this.storage[index] === 1 || this.floor[index] === 1 || this.ember[index] === 1 || this.built[index] !== Building.None || this.plan[index] !== Blueprint.None) return false;
    this.listRevision += 1;
    this.storage[index] = 1;
    this.storageTiles.push(index);
    this.host.wear[index] = WEAR_FULL;
    this.host.touch(index);
    return true;
  }

  release(index: TileIndex): boolean {
    if (this.storage[index] !== 1) return false;
    this.listRevision += 1;
    this.storage[index] = 0;
    this.storageTiles.splice(this.storageTiles.indexOf(index), 1);
    this.host.touch(index);
    return true;
  }

  isFloor(index: TileIndex): boolean {
    return index !== NOWHERE && this.floor[index] === 1;
  }

  floorSpace(index: TileIndex): number {
    return this.isFloor(index) ? Math.max(0, FLOOR_CAPACITY - this.host.items.at(index).length) : 0;
  }

  layFloor(index: TileIndex): boolean {
    if (!this.host.passable(index) || this.floor[index] === 1 || this.storage[index] === 1 || this.ember[index] === 1 || this.built[index] !== Building.None || this.plan[index] !== Blueprint.None) return false;
    this.listRevision += 1;
    this.floor[index] = 1;
    this.floors.push(index);
    this.host.wear[index] = WEAR_FULL;
    this.host.touch(index);
    return true;
  }

  unfloor(index: TileIndex): boolean {
    if (this.floor[index] !== 1) return false;
    this.listRevision += 1;
    this.floor[index] = 0;
    this.floors.splice(this.floors.indexOf(index), 1);
    this.host.touch(index);
    return true;
  }
}
