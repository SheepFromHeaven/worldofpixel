import type { TileIndex } from '../grid.ts';
import { NOWHERE } from '../grid.ts';
import { buildingIdOf, buildingOf, buildingOfPlan } from '../../content/buildings/index.ts';
import { Cover } from '../covers.ts';
import type { ItemType } from '../people/items.ts';
import { STACK_SIZE } from '../people/items.ts';
import type { GroundItems } from '../people/groundItems.ts';
import type { Column, Layer, LayerHost } from './layer.ts';
import { packColumns, unpackColumns } from './layer.ts';
import { WEAR_FULL } from './trails.ts';

const CAMPFIRE_ID = buildingIdOf('campfire');

const TORCH_ID = buildingIdOf('torch');

export const Blueprint = { None: 0, Campfire: 1, Relight: 2, Kindle: 3 } as const;

export const Building = { None: 0 } as const;

export type Building = number;

export interface StructuresHost extends LayerHost {
  readonly cover: Uint8Array;
  readonly river: Uint8Array;
  readonly wear: Uint8Array;
  readonly items: GroundItems;
  passable(tile: TileIndex): boolean;
  clearPlants(tile: TileIndex): void;
}

export interface StructureArrays {
  plan: Uint8Array;
  built: Uint8Array;
}

interface Lists {
  plans: number[];
  depths: number[];
  buildings: number[];
}

interface StructuresDelta {
  columns: Record<string, Column>;
  lists: Lists | null;
  fuel: number[];
}

export interface StructuresState {
  plans: [number, number][];
  buildings: [number, number][];
  fuels: number[];
  depths: number[];
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
    ({ plan: this.plan, built: this.built } = arrays);
    const count = this.built.length;
    this.storage = new Uint8Array(count);
    this.floor = new Uint8Array(count);
    this.fire = new Uint8Array(count);
    this.ember = new Uint8Array(count);
    this.torch = new Uint8Array(count);
    for (let tile = 0; tile < count; tile += 1) if (this.built[tile] !== Building.None) this.flag(tile);
  }

  private flag(index: TileIndex): void {
    const def = buildingOf(this.built[index]!);
    const lit = def?.fuelled !== undefined && def.fuelled !== null && this.fuelAt(index) > 0;
    this.storage[index] = def?.storage?.haul ? 1 : 0;
    this.floor[index] = def?.job ? 1 : 0;
    this.fire[index] = lit ? 1 : 0;
    this.ember[index] = def?.fuelled && !lit ? 1 : 0;
    this.torch[index] = def?.emits && def.emits.when === 'always' && !def.fuelled ? 1 : 0;
  }

  private reindex(): void {
    this.storageTiles.length = 0;
    this.floors.length = 0;
    this.fires.length = 0;
    this.embers.length = 0;
    this.torches.length = 0;
    for (const tile of this.buildings) {
      this.flag(tile);
      if (this.storage[tile] === 1) this.storageTiles.push(tile);
      if (this.floor[tile] === 1) this.floors.push(tile);
      if (this.fire[tile] === 1) this.fires.push(tile);
      if (this.ember[tile] === 1) this.embers.push(tile);
      if (this.torch[tile] === 1) this.torches.push(tile);
    }
    for (const tile of this.torchDepth.keys()) this.torches.push(tile);
  }

  columns(): Record<string, Column> {
    return { plan: this.plan, built: this.built };
  }

  pack(tiles: Int32Array): StructuresDelta {
    const lists =
      this.sentListRevision === this.listRevision
        ? null
        : { plans: [...this.plans], depths: this.depthPairs(), buildings: [...this.buildings] };
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
      replace(this.plans, lists.plans);
      replace(this.buildings, lists.buildings);
      this.torchDepth.clear();
      for (let at = 0; at + 1 < lists.depths.length; at += 2) this.torchDepth.set(lists.depths[at]!, lists.depths[at + 1]!);
    }
    this.fuel.clear();
    for (let at = 0; at + 1 < fuel.length; at += 2) this.fuel.set(fuel[at]!, fuel[at + 1]!);
    for (let at = 0; at < tiles.length; at += 1) this.flag(tiles[at]!);
    this.reindex();
  }

  introduce(): void {
    this.listRevision += 1;
  }

  snapshot(): StructuresState {
    const fuels: number[] = [];
    for (const tile of this.fires) fuels.push(tile, this.fuelAt(tile));
    return {
      plans: this.plans.map((tile) => [tile, this.plan[tile]!]),
      buildings: this.buildings.map((tile) => [tile, this.built[tile]!]),
      fuels,
      depths: this.depthPairs(),
    };
  }

  restore(saved: unknown): void {
    const state = saved as StructuresState;
    for (const [tile, kind] of state.plans) {
      this.plan[tile] = kind;
      this.plans.push(tile);
    }
    for (const [tile, kind] of state.buildings) this.raise(tile, kind as Building);
    for (let at = 0; at + 1 < state.fuels.length; at += 2) this.fuel.set(state.fuels[at]!, state.fuels[at + 1]!);
    for (let at = 0; at + 1 < state.depths.length; at += 2) this.torchDepth.set(state.depths[at]!, state.depths[at + 1]!);
    this.reindex();
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
    this.fuel.set(index, Math.min(buildingOf(this.built[index]!)!.fuelled!.capacity, this.fuelAt(index) + amount));
    return true;
  }

  burn(seconds: number): void {
    for (let at = this.fires.length - 1; at >= 0; at -= 1) {
      const tile = this.fires[at]!;
      const left = this.fuelAt(tile) - seconds * buildingOf(this.built[tile]!)!.fuelled!.burn;
      if (left > 0) this.fuel.set(tile, left);
      else this.burnOut(tile);
    }
  }

  private burnOut(index: TileIndex): void {
    this.listRevision += 1;
    this.fuel.delete(index);
    this.reindex();
    this.host.touch(index);
  }

  extinguish(index: TileIndex): boolean {
    if (this.fire[index] !== 1) return false;
    this.burnOut(index);
    return true;
  }

  clearEmber(index: TileIndex): boolean {
    if (this.ember[index] !== 1) return false;
    return this.demolish(index);
  }

  pull(index: TileIndex): boolean {
    if (index === NOWHERE || this.torch[index] !== 1) return false;
    return this.demolish(index);
  }

  kindle(index: TileIndex, start?: number): boolean {
    const standing = buildingOf(this.built[index]!);
    const hearth = standing?.fuelled ? standing : null;
    if (index === NOWHERE || this.fire[index] === 1 || this.host.cover[index] === Cover.Tree || (standing && !hearth && standing.needs.length > 0)) return false;
    const campfire = hearth ?? buildingOf(CAMPFIRE_ID)!;
    if (!hearth) {
      if (standing) this.demolish(index);
      this.unplan(index);
      this.raise(index, CAMPFIRE_ID);
    }
    this.listRevision += 1;
    this.fuel.set(index, Math.min(campfire.fuelled!.capacity, start ?? campfire.fuelled!.start));
    this.reindex();
    this.host.clearPlants(index);
    this.host.wear[index] = WEAR_FULL;
    this.host.touch(index);
    return true;
  }

  hasStructure(index: TileIndex): boolean {
    if (index === NOWHERE) return false;
    return this.plan[index] !== Blueprint.None || this.built[index] !== Building.None;
  }

  isPlanned(index: TileIndex): boolean {
    return index !== NOWHERE && this.plan[index] !== Blueprint.None;
  }

  planCampfire(index: TileIndex): boolean {
    if (!this.host.passable(index) || this.host.cover[index] === Cover.Tree || this.built[index] !== Building.None || this.plan[index] !== Blueprint.None) return false;
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

  placeable(index: TileIndex, trees: boolean): boolean {
    return this.host.passable(index) && this.ember[index] !== 1 && this.torch[index] === 0 && this.built[index] === Building.None && this.plan[index] === Blueprint.None && (trees || this.host.cover[index] !== Cover.Tree);
  }

  planBuilding(index: TileIndex, kind: number): boolean {
    const def = buildingOfPlan(kind);
    if (!def || !this.placeable(index, def.footprint.trees)) return false;
    this.listRevision += 1;
    this.plan[index] = kind;
    this.plans.push(index);
    this.host.touch(index);
    return true;
  }

  place(index: TileIndex, kind: Building): boolean {
    const def = buildingOf(kind);
    if (!def || !this.placeable(index, def.footprint.trees)) return false;
    return this.raise(index, kind);
  }

  raise(index: TileIndex, kind: Building): boolean {
    const def = buildingOf(kind);
    if (index === NOWHERE || !def || this.built[index] !== Building.None) return false;
    this.unplan(index);
    this.listRevision += 1;
    this.built[index] = kind;
    this.buildings.push(index);
    this.reindex();
    if (def.footprint.clears) this.host.clearPlants(index);
    if (def.footprint.trodden) this.host.wear[index] = WEAR_FULL;
    this.host.touch(index);
    return true;
  }

  demolish(index: TileIndex): boolean {
    if (index === NOWHERE || this.built[index] === Building.None) return false;
    this.listRevision += 1;
    this.built[index] = Building.None;
    this.fuel.delete(index);
    this.flag(index);
    this.buildings.splice(this.buildings.indexOf(index), 1);
    this.reindex();
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
    return this.host.passable(index) && this.torch[index] === 0 && this.built[index] === Building.None && this.host.cover[index] !== Cover.Tree;
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
      this.torchDepth.set(index, elevation);
      this.reindex();
      return true;
    }
    if (!this.plantable(index)) return false;
    return this.raise(index, TORCH_ID);
  }

  isStorage(index: TileIndex): boolean {
    return index !== NOWHERE && this.storage[index] === 1;
  }

  storageAccepts(index: TileIndex, kind: ItemType): boolean {
    const rule = buildingOf(this.built[index]!)?.storage;
    if (!rule?.haul) return false;
    const { items } = this.host;
    const stack = items.at(index);
    if (stack.length >= rule.capacity) return false;
    let same = 0;
    for (const slot of stack) if (items.kind[slot] === kind) same += 1;
    return same < (STACK_SIZE[kind] ?? 1) && (rule.mixed || stack.length === 0 || items.kind[stack[0]!] === kind);
  }

  capacityAt(index: TileIndex): number {
    return buildingOf(this.built[index]!)?.storage?.capacity ?? 0;
  }

  stationAt(index: TileIndex): string | null {
    return buildingOf(this.built[index]!)?.job?.station ?? null;
  }

  jobSlots(index: TileIndex): number {
    return buildingOf(this.built[index]!)?.job?.slots ?? 0;
  }

  isFloor(index: TileIndex): boolean {
    return index !== NOWHERE && this.floor[index] === 1;
  }

  floorSpace(index: TileIndex): number {
    return this.isFloor(index) ? Math.max(0, this.capacityAt(index) - this.host.items.at(index).length) : 0;
  }
}
