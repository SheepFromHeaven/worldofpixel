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

  get count(): number {
    return this.live;
  }

  add(tile: TileIndex, kind: ItemType): number {
    const slot = this.vacant.pop() ?? (this.used < GROUND_ITEM_CAPACITY ? this.used++ : -1);
    if (slot < 0) return -1;

    const stack = this.byTile.get(tile);

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
