import { NOWHERE, TILE, TileGrid, WORLD_TILES } from '../sim/grid.ts';
import type { LevelResult, Logger } from './harness.ts';
import { check } from './harness.ts';
import { header } from './render.ts';

export function runLevel1(log: Logger): LevelResult {
  log(header('LEVEL 1 — The grid: a point falls in one tile, and that tile knows where it is'));

  const grid = TileGrid.world();
  log(`    ${grid.columns} x ${grid.rows} tiles, ${grid.count} in all, ${TILE}m to a tile`);

  let roundTrips = true;
  let inBounds = true;
  for (let row = 0; row < grid.rows; row += 97) {
    for (let column = 0; column < grid.columns; column += 89) {
      const index = grid.at(column, row);
      const centre = grid.centre(index);
      if (grid.atPoint(centre) !== index) roundTrips = false;

      const box = grid.bounds(index);
      if (
        centre.x <= box.minX ||
        centre.x >= box.maxX ||
        centre.y <= box.minY ||
        centre.y >= box.maxY
      ) {
        inBounds = false;
      }
    }
  }

  let corners = true;
  for (let row = 0; row < grid.rows; row += 211) {
    for (let column = 0; column < grid.columns; column += 199) {
      const box = grid.bounds(grid.at(column, row));
      const nudge = TILE * 1e-3;
      if (grid.atPoint({ x: box.minX + nudge, y: box.minY + nudge }) !== grid.at(column, row)) {
        corners = false;
      }
      if (grid.atPoint({ x: box.maxX - nudge, y: box.maxY - nudge }) !== grid.at(column, row)) {
        corners = false;
      }
    }
  }

  const offGrid =
    grid.at(-1, 0) === NOWHERE &&
    grid.at(0, -1) === NOWHERE &&
    grid.at(grid.columns, 0) === NOWHERE &&
    grid.at(0, grid.rows) === NOWHERE;

  const span = { x: 0, y: 0 };
  let within = 0;
  for (const _ of grid.within({ minX: span.x, minY: span.y, maxX: span.x + 9.5, maxY: span.y + 9.5 })) {
    within += 1;
  }

  const holdsWorld =
    grid.columns * TILE >= WORLD_TILES.columns * TILE &&
    grid.rows * TILE >= WORLD_TILES.rows * TILE;

  const held = [
    check(log, 'a tile centre lands back in its own tile', roundTrips),
    check(log, 'a tile centre lies strictly inside its own bounds', inBounds),
    check(log, 'both corners of a tile belong to it', corners),
    check(log, 'asking off the grid gives nowhere', offGrid),
    check(log, 'a ten metre box holds a hundred tiles', within === 100, `${within}`),
    check(log, 'the grid covers the whole world and its margin', holdsWorld),
  ];

  const passed = held.every(Boolean);
  return {
    title: 'the grid',
    passed,
    detail: passed ? `${grid.count} tiles, every one findable` : 'the grid does not answer for itself',
  };
}
