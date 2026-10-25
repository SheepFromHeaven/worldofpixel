import type { TileGrid } from './grid.ts';

const SQRT2 = Math.SQRT2;

export function distanceFrom(grid: TileGrid, sources: Uint8Array): Float32Array {
  const { columns, rows } = grid;
  const distance = new Float32Array(grid.count);
  for (let i = 0; i < grid.count; i += 1) distance[i] = sources[i] === 1 ? 0 : 1e9;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const i = row * columns + column;
      let best = distance[i]!;
      if (column > 0) best = Math.min(best, distance[i - 1]! + 1);
      if (row > 0) {
        best = Math.min(best, distance[i - columns]! + 1);
        if (column > 0) best = Math.min(best, distance[i - columns - 1]! + SQRT2);
        if (column < columns - 1) best = Math.min(best, distance[i - columns + 1]! + SQRT2);
      }
      distance[i] = best;
    }
  }

  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      const i = row * columns + column;
      let best = distance[i]!;
      if (column < columns - 1) best = Math.min(best, distance[i + 1]! + 1);
      if (row < rows - 1) {
        best = Math.min(best, distance[i + columns]! + 1);
        if (column < columns - 1) best = Math.min(best, distance[i + columns + 1]! + SQRT2);
        if (column > 0) best = Math.min(best, distance[i + columns - 1]! + SQRT2);
      }
      distance[i] = best;
    }
  }

  return distance;
}
