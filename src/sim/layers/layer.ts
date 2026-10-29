import type { TileIndex } from '../grid.ts';

export type Column = Uint8Array | Uint16Array;

export type Columns = Readonly<Record<string, Column>>;

export interface LayerHost {
  mark(tile: TileIndex): void;
  touch(tile: TileIndex): void;
}

export interface Layer {
  readonly id: string;
  columns(): Record<string, Column>;
  pack(tiles: Int32Array): unknown;
  unpack(tiles: Int32Array, delta: unknown): readonly TileIndex[] | void;
  introduce(): void;
  snapshot(): unknown;
  restore(saved: unknown): void;
}

export function packColumns(tiles: Int32Array, columns: Columns): Record<string, Column> {
  const out: Record<string, Column> = {};
  for (const [name, source] of Object.entries(columns)) {
    out[name] = source instanceof Uint16Array ? Uint16Array.from(tiles, (tile) => source[tile]!) : Uint8Array.from(tiles, (tile) => source[tile]!);
  }
  return out;
}

export function unpackColumns(tiles: Int32Array, columns: Columns, packed: Columns): void {
  for (const [name, target] of Object.entries(columns)) {
    const values = packed[name]!;
    for (let at = 0; at < tiles.length; at += 1) target[tiles[at]!] = values[at]!;
  }
}

export function sparse(array: Column): number[] {
  const pairs: number[] = [];
  for (let tile = 0; tile < array.length; tile += 1) if (array[tile] !== 0) pairs.push(tile, array[tile]!);
  return pairs;
}
