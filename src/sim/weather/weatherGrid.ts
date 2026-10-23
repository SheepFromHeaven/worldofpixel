export class WeatherGrid {
  readonly cellCount: number;

  constructor(
    readonly columns: number,
    readonly rows: number,
  ) {
    this.cellCount = columns * rows;
  }

  createCellArray(): Float32Array {
    return new Float32Array(this.cellCount);
  }

  cellIndex(column: number, row: number): number {
    return row * this.columns + column;
  }

  clampedCellIndex(column: number, row: number): number {
    const clampedColumn = Math.min(this.columns - 1, Math.max(0, column));
    const clampedRow = Math.min(this.rows - 1, Math.max(0, row));
    return clampedRow * this.columns + clampedColumn;
  }

  valueAtClamped(field: Float32Array, column: number, row: number): number {
    return field[this.clampedCellIndex(column, row)]!;
  }

  bilinearSample(field: Float32Array, column: number, row: number): number {
    const clampedColumn = Math.min(this.columns - 1.001, Math.max(0, column));
    const clampedRow = Math.min(this.rows - 1.001, Math.max(0, row));
    const wholeColumn = Math.floor(clampedColumn);
    const wholeRow = Math.floor(clampedRow);
    const fractionColumn = clampedColumn - wholeColumn;
    const fractionRow = clampedRow - wholeRow;
    const topLeft = field[wholeRow * this.columns + wholeColumn]!;
    const topRight = field[wholeRow * this.columns + wholeColumn + 1]!;
    const bottomLeft = field[(wholeRow + 1) * this.columns + wholeColumn]!;
    const bottomRight = field[(wholeRow + 1) * this.columns + wholeColumn + 1]!;
    return (
      topLeft +
      (topRight - topLeft) * fractionColumn +
      (bottomLeft - topLeft) * fractionRow +
      (topLeft - topRight - bottomLeft + bottomRight) * fractionColumn * fractionRow
    );
  }
}
