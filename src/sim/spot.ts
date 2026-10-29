import type { Vec2 } from './geometry.ts';
import { WORLD_EXTENT } from './terrain/terrain.ts';
import type { World } from './world.ts';

const OPEN_STRIDE = 7;

export function openingSpot(world: World): Vec2 {
  const { grid } = world;
  const middle = { column: grid.column(WORLD_EXTENT.width / 2), row: grid.row(WORLD_EXTENT.height / 2) };
  const rings = Math.ceil(Math.max(grid.columns, grid.rows) / (2 * OPEN_STRIDE));

  for (let ring = 0; ring <= rings; ring += 1) {
    for (let dr = -ring; dr <= ring; dr += 1) {
      for (let dc = -ring; dc <= ring; dc += 1) {
        if (ring > 0 && Math.abs(dr) !== ring && Math.abs(dc) !== ring) continue;
        const index = grid.at(middle.column + dc * OPEN_STRIDE, middle.row + dr * OPEN_STRIDE);
        if (world.walkable(index)) return grid.centre(index);
      }
    }
  }

  return { x: WORLD_EXTENT.width / 2, y: WORLD_EXTENT.height / 2 };
}
