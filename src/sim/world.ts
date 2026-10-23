import type { Bounds, Vec2 } from './geometry.ts';
import type { TileGrid, TileIndex } from './grid.ts';
import { NOWHERE } from './grid.ts';
import { Tile } from './tile.ts';
import type { Biome } from './types.ts';
import type { WorldField } from './terrain/worldfield.ts';
import { fieldFor, isWater } from './terrain/worldfield.ts';
import { coverFor } from './cover.ts';

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

export const WEAR_FULL = 255;

const FADE_BAND = 1 << 16;

export const FADE_SWEEPS = (count: number): number => Math.ceil(count / FADE_BAND);

export const BLOCK_TILES = 64;

export class World {
  readonly seed: number;
  readonly grid: TileGrid;
  readonly field: WorldField;

  readonly biome: Uint8Array;
  readonly cover: Uint8Array;
  readonly wear: Uint8Array;
  readonly wind: Uint8Array;

  readonly stamps: Uint32Array;
  readonly blockColumns: number;

  revision = 0;

  private fading = 0;

  private constructor(seed: number, field: WorldField) {
    this.seed = seed;
    this.field = field;
    this.grid = field.grid;
    this.biome = field.biome;
    this.cover = coverFor(seed, field);
    this.wind = field.wind;
    this.wear = new Uint8Array(field.grid.count);

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

  tread(index: TileIndex, steps = 1): void {
    const worn = this.wear[index]!;
    const capped = Math.min(WEAR_FULL, worn + steps);
    if (capped >> 4 !== worn >> 4) this.touch(index);
    this.wear[index] = capped;
  }

  fell(index: TileIndex): boolean {
    if (this.cover[index] !== Cover.Tree) return false;
    this.cover[index] = Cover.Fallen;
    this.touch(index);
    return true;
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

  fade(): void {
    const { wear } = this;
    const end = Math.min(wear.length, this.fading + FADE_BAND);
    for (let i = this.fading; i < end; i += 1) {
      const worn = wear[i]!;
      if (worn > 0) wear[i] = worn - 1;
    }
    this.fading = end >= wear.length ? 0 : end;
  }
}
