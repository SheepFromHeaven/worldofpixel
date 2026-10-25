import type { TileIndex } from '../grid.ts';
import { ItemType } from './items.ts';

export const GROUND_ITEM_CAPACITY = 16384;

export class GroundItems {
  readonly tile = new Int32Array(GROUND_ITEM_CAPACITY);
  readonly kind = new Uint8Array(GROUND_ITEM_CAPACITY);

  used = 0;

  private readonly vacant: number[] = [];
  private readonly byTile = new Map<TileIndex, number[]>();
  private live = 0;
  private readonly burning = new Set<number>();
  private readonly dirty = new Set<TileIndex>();

  get count(): number {
    return this.live;
  }

  add(tile: TileIndex, kind: ItemType): number {
    const slot = this.vacant.pop() ?? (this.used < GROUND_ITEM_CAPACITY ? this.used++ : -1);
    if (slot < 0) return -1;

    const stack = this.byTile.get(tile);

    this.dirty.add(tile);
    this.tile[slot] = tile;
    this.kind[slot] = kind;
    if (stack) stack.push(slot);
    else this.byTile.set(tile, [slot]);
    if (kind === ItemType.BurningBranch) this.burning.add(slot);
    this.live += 1;
    return slot;
  }

  remove(slot: number): void {
    if (this.kind[slot] === ItemType.None) return;

    const tile = this.tile[slot]!;
    const stack = this.byTile.get(tile);
    this.dirty.add(tile);
    if (stack) {
      stack.splice(stack.indexOf(slot), 1);
      if (stack.length === 0) this.byTile.delete(tile);
    }
    this.kind[slot] = ItemType.None;
    this.burning.delete(slot);
    this.vacant.push(slot);
    this.live -= 1;
  }

  state(): number[][] {
    const live: number[][] = [];
    for (let slot = 0; slot < this.used; slot += 1) {
      if (this.kind[slot] !== ItemType.None) live.push([this.tile[slot]!, this.kind[slot]!]);
    }
    return live;
  }

  restore(entries: readonly (readonly number[])[]): void {
    for (let slot = 0; slot < this.used; slot += 1) this.remove(slot);
    this.used = 0;
    this.vacant.length = 0;
    this.byTile.clear();
    this.burning.clear();
    this.live = 0;
    for (const [tile, kind] of entries) {
      if (tile === undefined || kind === undefined) continue;
      this.add(tile, kind as ItemType);
    }
  }

  invalidate(): void {
    for (const tile of this.byTile.keys()) this.dirty.add(tile);
  }

  drain(): number[] {
    const flat: number[] = [];
    for (const tile of this.dirty) {
      const stack = this.byTile.get(tile) ?? [];
      flat.push(tile, stack.length);
      for (const slot of stack) flat.push(slot, this.kind[slot]!);
    }
    this.dirty.clear();
    return flat;
  }

  apply(flat: readonly number[]): TileIndex[] {
    const touched: TileIndex[] = [];
    for (let at = 0; at < flat.length; at += 2 + flat[at + 1]! * 2) {
      const tile = flat[at]!;
      for (const slot of this.byTile.get(tile) ?? []) {
        this.kind[slot] = ItemType.None;
        this.burning.delete(slot);
        this.live -= 1;
      }
      this.byTile.delete(tile);
      touched.push(tile);
    }
    for (let at = 0; at < flat.length; ) {
      const tile = flat[at]!;
      const count = flat[at + 1]!;
      at += 2;
      if (count === 0) continue;
      const stack: number[] = [];
      for (let entry = 0; entry < count; entry += 1) {
        const slot = flat[at]!;
        const kind = flat[at + 1]! as ItemType;
        at += 2;
        this.tile[slot] = tile;
        this.kind[slot] = kind;
        if (kind === ItemType.BurningBranch) this.burning.add(slot);
        if (slot >= this.used) this.used = slot + 1;
        stack.push(slot);
        this.live += 1;
      }
      this.byTile.set(tile, stack);
    }
    return touched;
  }

  burningTiles(): TileIndex[] {
    const tiles: TileIndex[] = [];
    for (const slot of this.burning) tiles.push(this.tile[slot]!);
    return tiles;
  }

  at(tile: TileIndex): readonly number[] {
    return this.byTile.get(tile) ?? [];
  }

  find(tile: TileIndex, kind: ItemType): number {
    for (const slot of this.at(tile)) if (this.kind[slot] === kind) return slot;
    return -1;
  }

  tally(tile: TileIndex, kind: ItemType): number {
    let found = 0;
    for (const slot of this.at(tile)) if (this.kind[slot] === kind) found += 1;
    return found;
  }

  kindsAt(tile: TileIndex): ItemType[] {
    const kinds: ItemType[] = [];
    for (const slot of this.at(tile)) {
      const kind = this.kind[slot] as ItemType;
      if (!kinds.includes(kind)) kinds.push(kind);
    }
    return kinds;
  }
}
