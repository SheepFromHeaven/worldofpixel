import type { Vec2 } from './geometry.ts';
import { latitudesOf } from './terrain/climate.ts';
import { WORLD_EXTENT } from './terrain/terrain.ts';
import { Biome } from './types.ts';
import type { World } from './world.ts';

const OPEN_STRIDE = 7;

const OPENING_LATITUDE = 45;

const GOOD_ECO = 150;

const ROOM_TILES = 20;

const ROOM_WANTED = 500;

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

function roomFrom(world: World, start: number): { tiles: number; shore: boolean } {
  const { grid } = world;
  const column = grid.columnOf(start);
  const row = grid.rowOf(start);
  const seen = new Set<number>([start]);
  const queue = [start];
  let shore = false;
  for (let head = 0; head < queue.length; head += 1) {
    const here = queue[head]!;
    for (const [dc, dr] of STEPS) {
      const next = grid.at(grid.columnOf(here) + dc, grid.rowOf(here) + dr);
      if (next < 0 || seen.has(next)) continue;
      if (world.drinkable(next)) {
        shore = true;
        continue;
      }
      if (Math.abs(grid.columnOf(next) - column) > ROOM_TILES || Math.abs(grid.rowOf(next) - row) > ROOM_TILES || !world.movement.passable(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return { tiles: queue.length, shore };
}

function livable(world: World, index: number): boolean {
  if (!world.walkable(index)) return false;
  const biome = world.biome[index]!;
  if ((biome !== Biome.Meadow && biome !== Biome.Forest) || world.eco[index]! < GOOD_ECO) return false;
  const room = roomFrom(world, index);
  return room.shore && room.tiles >= ROOM_WANTED;
}

export function openingSpot(world: World): Vec2 {
  const { grid } = world;
  const { north, south } = latitudesOf(world.seed);
  const middle = { column: grid.column(WORLD_EXTENT.width / 2), row: grid.row(WORLD_EXTENT.height * ((north - OPENING_LATITUDE) / (north - south))) };
  const rings = Math.ceil(Math.max(grid.columns, grid.rows) / (2 * OPEN_STRIDE));

  for (let ring = 0; ring <= rings; ring += 1) {
    for (let dr = -ring; dr <= ring; dr += 1) {
      for (let dc = -ring; dc <= ring; dc += 1) {
        if (ring > 0 && Math.abs(dr) !== ring && Math.abs(dc) !== ring) continue;
        const index = grid.at(middle.column + dc * OPEN_STRIDE, middle.row + dr * OPEN_STRIDE);
        if (livable(world, index)) return grid.centre(index);
      }
    }
  }

  return { x: WORLD_EXTENT.width / 2, y: WORLD_EXTENT.height / 2 };
}
