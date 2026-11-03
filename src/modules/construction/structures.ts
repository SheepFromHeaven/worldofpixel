import type { TileGrid, TileIndex } from '../../sim/grid.ts';
import { NOWHERE } from '../../sim/grid.ts';
import { turned } from '../../content/stations/definition.ts';
import type { StationDef } from '../../content/stations/definition.ts';
import { buildableOf, buildableOfPlan, isBuildPlan } from '../../content/buildables.ts';
import { stationIdOf, stationOf } from '../../content/stations/index.ts';
import { Cover } from '../../sim/covers.ts';
import { itemIdOf } from '../../content/items/index.ts';
import type { ItemType } from '../items/api.ts';
import { STACK_SIZE } from '../items/api.ts';
import type { GroundItems } from '../items/api.ts';
import type { Column, Layer, LayerHost } from '../../sim/layers/layer.ts';
import { packColumns, unpackColumns } from '../../sim/layers/layer.ts';
import { WEAR_FULL } from '../trails/api.ts';

const CAMPFIRE_ID = stationIdOf('campfire');

const TORCH_ID = stationIdOf('torch');

export const Blueprint = { None: 0, Campfire: 1, Relight: 2, Kindle: 3 } as const;

export const Station = { None: 0 } as const;

export type Station = number;

export interface Fit {
  readonly tile: TileIndex;
  readonly reason: string | null;
}

export interface StructuresHost extends LayerHost {
  readonly grid: TileGrid;
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
  stations: number[];
  blocks: number[];
}

interface StructuresDelta {
  columns: Record<string, Column>;
  lists: Lists | null;
  fuel: number[];
}

export interface StructuresState {
  plans: [number, number, number][];
  stations: [number, number, number][];
  blocks: [number, number][];
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
  readonly block: Uint8Array;
  readonly turn: Uint8Array;
  readonly part: Uint8Array;
  readonly storageTiles: TileIndex[] = [];
  readonly floors: TileIndex[] = [];
  readonly fires: TileIndex[] = [];
  readonly embers: TileIndex[] = [];
  readonly torches: TileIndex[] = [];
  readonly plans: TileIndex[] = [];
  readonly stations: TileIndex[] = [];
  readonly blocks: TileIndex[] = [];
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
    this.block = new Uint8Array(count);
    this.turn = new Uint8Array(count);
    this.part = new Uint8Array(count);
    this.storage = new Uint8Array(count);
    this.floor = new Uint8Array(count);
    this.fire = new Uint8Array(count);
    this.ember = new Uint8Array(count);
    this.torch = new Uint8Array(count);
    for (let tile = 0; tile < count; tile += 1) if (this.built[tile] !== Station.None) this.flag(tile);
  }

  private flag(index: TileIndex): void {
    const def = this.part[index] === 0 ? stationOf(this.built[index]!) : undefined;
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
    for (const tile of this.stations) {
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
    return { plan: this.plan, built: this.built, block: this.block, turn: this.turn, part: this.part };
  }

  pack(tiles: Int32Array): StructuresDelta {
    const lists =
      this.sentListRevision === this.listRevision
        ? null
        : { plans: [...this.plans], depths: this.depthPairs(), stations: [...this.stations], blocks: [...this.blocks] };
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
      replace(this.stations, lists.stations);
      replace(this.blocks, lists.blocks);
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
      plans: this.plans.map((tile) => [tile, this.plan[tile]!, this.turn[tile]!]),
      stations: this.stations.map((tile) => [tile, this.built[tile]!, this.turn[tile]!]),
      blocks: this.blocks.map((tile) => [tile, this.block[tile]!]),
      fuels,
      depths: this.depthPairs(),
    };
  }

  restore(saved: unknown): void {
    const state = saved as StructuresState;
    for (const [tile, kind, turn] of state.plans) {
      if (isBuildPlan(kind)) this.writePlan(tile, kind, turn);
      else {
        this.plan[tile] = kind;
        this.plans.push(tile);
      }
    }
    for (const [tile, kind, turn] of state.stations) this.raise(tile, kind as Station, turn);
    for (const [tile, kind] of state.blocks) this.raise(tile, kind);
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
    this.fuel.set(index, Math.min(stationOf(this.built[index]!)!.fuelled!.capacity, this.fuelAt(index) + amount));
    return true;
  }

  burn(seconds: number): void {
    for (let at = this.fires.length - 1; at >= 0; at -= 1) {
      const tile = this.fires[at]!;
      const left = this.fuelAt(tile) - seconds * stationOf(this.built[tile]!)!.fuelled!.burn;
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

  canKindle(index: TileIndex): boolean {
    if (index === NOWHERE || this.fire[index] === 1 || this.host.cover[index] === Cover.Tree) return false;
    const standing = stationOf(this.built[index]!);
    return !(standing && !standing.fuelled && standing.needs.length > 0);
  }

  kindle(index: TileIndex, start?: number): boolean {
    if (!this.canKindle(index)) return false;
    const standing = stationOf(this.built[index]!);
    const hearth = standing?.fuelled ? standing : null;
    const campfire = hearth ?? stationOf(CAMPFIRE_ID)!;
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
    return this.plan[index] !== Blueprint.None || this.built[index] !== Station.None || this.block[index] !== 0;
  }

  isPlanned(index: TileIndex): boolean {
    return index !== NOWHERE && this.plan[index] !== Blueprint.None;
  }

  planCampfire(index: TileIndex): boolean {
    if (!this.host.passable(index) || this.host.cover[index] === Cover.Tree || this.built[index] !== Station.None || this.plan[index] !== Blueprint.None) return false;
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

  cellsOf(def: StationDef, index: TileIndex, turn: number): TileIndex[] {
    const { grid } = this.host;
    const column = grid.columnOf(index);
    const row = grid.rowOf(index);
    return def.footprint.cells.map((cell) => {
      const [dx, dy] = turned(cell, turn);
      return grid.at(column + dx, row + dy);
    });
  }

  fit(def: StationDef, index: TileIndex, turn: number): Fit[] {
    return this.cellsOf(def, index, turn).map((tile) => ({ tile, reason: tile === NOWHERE ? 'off the map' : this.refusal(tile, def) }));
  }

  private refusal(tile: TileIndex, def: StationDef): string | null {
    const placed = this.block[tile]!;
    const wall = placed !== 0 && buildableOf(placed)!.solid;
    if (this.plan[tile] !== Blueprint.None) return 'already planned';
    if (def.layer === 'block') {
      if (placed !== 0) return 'already built on';
      if (def.solid && this.built[tile] !== Station.None) return 'already built on';
    } else {
      if (this.built[tile] !== Station.None) return 'already built on';
      if (wall) return 'a wall is in the way';
    }
    if (this.host.cover[tile] === Cover.Tree && !def.ground.trees) return 'a tree is in the way';
    if (!this.host.passable(tile)) return 'cannot stand here';
    return null;
  }

  fits(def: StationDef, index: TileIndex, turn: number): boolean {
    return this.fit(def, index, turn).every((cell) => cell.reason === null);
  }

  private defAt(index: TileIndex): StationDef | undefined {
    return this.built[index] !== Station.None ? stationOf(this.built[index]!) : buildableOfPlan(this.plan[index]!);
  }

  anchorOf(index: TileIndex): TileIndex {
    const part = this.part[index];
    if (index === NOWHERE || part === 0) return index;
    const cell = this.defAt(index!)?.footprint.cells[part!];
    if (!cell) return index;
    const [dx, dy] = turned(cell, this.turn[index]!);
    const { grid } = this.host;
    return grid.at(grid.columnOf(index) - dx, grid.rowOf(index) - dy);
  }

  private cellsAround(anchor: TileIndex, def: StationDef): TileIndex[] {
    return this.cellsOf(def, anchor, this.turn[anchor]!).filter((tile) => tile !== NOWHERE);
  }

  tilesOf(anchor: TileIndex): TileIndex[] {
    const def = this.defAt(anchor);
    return def ? this.cellsAround(anchor, def) : [anchor];
  }

  placeable(index: TileIndex, trees: boolean): boolean {
    return this.host.passable(index) && this.ember[index] !== 1 && this.torch[index] === 0 && this.built[index] === Station.None && this.plan[index] === Blueprint.None && (trees || this.host.cover[index] !== Cover.Tree);
  }

  private writePlan(index: TileIndex, kind: number, turn: number): void {
    const def = buildableOfPlan(kind)!;
    this.listRevision += 1;
    const cells = this.cellsOf(def, index, turn);
    cells.forEach((tile, part) => {
      if (tile === NOWHERE) return;
      this.plan[tile] = kind;
      if (this.built[tile] === Station.None) {
        this.turn[tile] = turn;
        this.part[tile] = part;
      }
      this.host.touch(tile);
    });
    this.plans.push(index);
  }

  planStation(index: TileIndex, kind: number, turn = 0): boolean {
    const def = buildableOfPlan(kind);
    if (!def || index === NOWHERE || !this.fits(def, index, turn)) return false;
    this.writePlan(index, kind, def.footprint.rotates ? turn : 0);
    return true;
  }

  place(index: TileIndex, kind: number, turn = 0): boolean {
    const def = buildableOf(kind);
    if (!def || index === NOWHERE || !this.fits(def, index, turn)) return false;
    return this.raise(index, kind, turn);
  }

  raise(index: TileIndex, kind: number, turn = 0): boolean {
    const def = buildableOf(kind);
    if (index === NOWHERE || !def) return false;
    if (def.layer === 'block') return this.lay(index, kind, def);
    const spin = def.footprint.rotates ? turn : 0;
    const cells = this.cellsOf(def, index, spin);
    if (cells.some((tile) => tile === NOWHERE || this.built[tile] !== Station.None)) return false;
    this.unplan(index);
    this.listRevision += 1;
    cells.forEach((tile, part) => {
      this.built[tile] = kind;
      this.turn[tile] = spin;
      this.part[tile] = part;
      if (def.ground.clears) this.host.clearPlants(tile);
      if (def.ground.trodden) this.host.wear[tile] = WEAR_FULL;
    });
    this.stations.push(index);
    this.reindex();
    for (const tile of cells) this.host.touch(tile);
    return true;
  }

  private lay(index: TileIndex, kind: number, def: StationDef): boolean {
    if (this.block[index] !== 0) return false;
    this.unplan(index);
    this.listRevision += 1;
    this.block[index] = kind;
    this.blocks.push(index);
    if (def.ground.clears) this.host.clearPlants(index);
    if (def.ground.trodden) this.host.wear[index] = WEAR_FULL;
    this.host.touch(index);
    return true;
  }

  private forget(list: TileIndex[], tile: TileIndex): void {
    const at = list.indexOf(tile);
    if (at >= 0) list.splice(at, 1);
  }

  demolish(index: TileIndex): boolean {
    if (index !== NOWHERE && this.built[index] === Station.None && this.block[index] !== 0) {
      const laid = buildableOf(this.block[index]!);
      this.listRevision += 1;
      this.block[index] = 0;
      this.forget(this.blocks, index);
      this.recover(laid, index);
      this.host.touch(index);
      return true;
    }
    if (index === NOWHERE || this.built[index] === Station.None) return false;
    const anchor = this.anchorOf(index);
    const def = stationOf(this.built[anchor]!)!;
    const cells = this.cellsAround(anchor, def);
    this.listRevision += 1;
    this.fuel.delete(anchor);
    for (const tile of cells) {
      this.built[tile] = Station.None;
      this.turn[tile] = 0;
      this.part[tile] = 0;
      this.flag(tile);
    }
    this.forget(this.stations, anchor);
    this.reindex();
    this.recover(def, anchor);
    for (const tile of cells) this.host.touch(tile);
    return true;
  }

  private recover(def: StationDef | undefined, tile: TileIndex): void {
    if (!def) return;
    for (const [key, count] of def.salvage) for (let each = 0; each < count; each += 1) this.host.items.add(tile, itemIdOf(key) as ItemType);
  }

  isBuilt(index: TileIndex, kind: Station): boolean {
    return index !== NOWHERE && this.built[index] === kind;
  }

  unplan(index: TileIndex): boolean {
    if (index === NOWHERE || this.plan[index] === Blueprint.None) return false;
    const anchor = this.anchorOf(index);
    const kind = this.plan[anchor]!;
    const def = buildableOfPlan(kind);
    const cells = def ? this.cellsAround(anchor, def) : [anchor];
    this.listRevision += 1;
    for (const tile of cells) {
      this.plan[tile] = Blueprint.None;
      if (def && this.built[tile] === Station.None) {
        this.turn[tile] = 0;
        this.part[tile] = 0;
      }
      this.host.touch(tile);
    }
    this.forget(this.plans, anchor);
    return true;
  }

  plantable(index: TileIndex): boolean {
    return this.host.passable(index) && this.torch[index] === 0 && this.built[index] === Station.None && this.host.cover[index] !== Cover.Tree;
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
    const rule = stationOf(this.built[index]!)?.storage;
    if (!rule?.haul) return false;
    const { items } = this.host;
    const stack = items.at(index);
    if (stack.length >= rule.capacity) return false;
    let same = 0;
    for (const slot of stack) if (items.kind[slot] === kind) same += 1;
    return same < (STACK_SIZE[kind] ?? 1) && (rule.mixed || stack.length === 0 || items.kind[stack[0]!] === kind);
  }

  capacityAt(index: TileIndex): number {
    return stationOf(this.built[index]!)?.storage?.capacity ?? 0;
  }

  stationAt(index: TileIndex): string | null {
    return stationOf(this.built[index]!)?.job?.station ?? null;
  }

  jobSlots(index: TileIndex): number {
    return stationOf(this.built[index]!)?.job?.slots ?? 0;
  }

  isFloor(index: TileIndex): boolean {
    return index !== NOWHERE && this.floor[index] === 1;
  }

  floorSpace(index: TileIndex): number {
    return this.isFloor(index) ? Math.max(0, this.capacityAt(index) - this.host.items.at(index).length) : 0;
  }
}
