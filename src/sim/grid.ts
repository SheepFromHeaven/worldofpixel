import type { Bounds, Vec2 } from './geometry.ts';

export const TILE = 1;

export const TEXELS_PER_TILE = 16;

export const TEXEL = TILE / TEXELS_PER_TILE;

export const WORLD_TILES = { columns: 2048, rows: 1408 };

export const MARGIN_TILES = 64;

export type TileIndex = number;

export const NOWHERE: TileIndex = -1;

export class TileGrid {
  readonly columns: number;
  readonly rows: number;
  readonly minX: number;
  readonly minY: number;
  readonly spacing: number;
  readonly count: number;

  constructor(columns: number, rows: number, minX: number, minY: number, spacing: number) {
    this.columns = columns;
    this.rows = rows;
    this.minX = minX;
    this.minY = minY;
    this.spacing = spacing;
    this.count = columns * rows;
  }

  static world(spacing = TILE): TileGrid {
    const margin = MARGIN_TILES * TILE;
    return new TileGrid(
      Math.ceil((WORLD_TILES.columns * TILE + margin * 2) / spacing),
      Math.ceil((WORLD_TILES.rows * TILE + margin * 2) / spacing),
      -margin,
      -margin,
      spacing,
    );
  }

  column(x: number): number {
    const column = Math.floor((x - this.minX) / this.spacing);
    return column < 0 ? 0 : column >= this.columns ? this.columns - 1 : column;
  }

  row(y: number): number {
    const row = Math.floor((y - this.minY) / this.spacing);
    return row < 0 ? 0 : row >= this.rows ? this.rows - 1 : row;
  }

  columnOf(index: TileIndex): number {
    return index % this.columns;
  }

  rowOf(index: TileIndex): number {
    return (index - (index % this.columns)) / this.columns;
  }

  at(column: number, row: number): TileIndex {
    if (column < 0 || row < 0 || column >= this.columns || row >= this.rows) return NOWHERE;
    return row * this.columns + column;
  }

  atPoint(point: Vec2): TileIndex {
    return this.row(point.y) * this.columns + this.column(point.x);
  }

  x(column: number): number {
    return this.minX + (column + 0.5) * this.spacing;
  }

  y(row: number): number {
    return this.minY + (row + 0.5) * this.spacing;
  }

  centre(index: TileIndex): Vec2 {
    return { x: this.x(this.columnOf(index)), y: this.y(this.rowOf(index)) };
  }

  bounds(index: TileIndex): Bounds {
    const minX = this.minX + this.columnOf(index) * this.spacing;
    const minY = this.minY + this.rowOf(index) * this.spacing;
    return { minX, minY, maxX: minX + this.spacing, maxY: minY + this.spacing };
  }

  holds(column: number, row: number): boolean {
    return column >= 0 && row >= 0 && column < this.columns && row < this.rows;
  }

  *within(bounds: Bounds): Generator<TileIndex> {
    const first = this.column(bounds.minX);
    const last = this.column(bounds.maxX);
    const top = this.row(bounds.minY);
    const bottom = this.row(bounds.maxY);

    for (let row = top; row <= bottom; row += 1) {
      for (let column = first; column <= last; column += 1) yield row * this.columns + column;
    }
  }
}

export const SIDES: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export const AROUND: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];
