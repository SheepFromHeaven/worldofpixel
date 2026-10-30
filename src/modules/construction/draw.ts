import { buildableOfPlan } from '../../content/buildables.ts';
import { BLOCKS } from '../../content/blocks/index.ts';
import { STATIONS } from '../../content/stations/index.ts';
import { NOWHERE } from '../../sim/grid.ts';
import { hash2 } from '../../sim/rng.ts';
import type { World } from '../../sim/world.ts';
import type { Drawable, Stamp } from '../clientSlots.ts';

const FENCE_SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

const FENCE_STONES = 3;

const FENCE_GAP = 0.32;

const middleOf = (world: World, tile: number): { x: number; y: number } => {
  const cells = world.structures.tilesOf(tile).map((cell) => world.grid.centre(cell));
  return { x: cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length, y: cells.reduce((sum, cell) => sum + cell.y, 0) / cells.length };
};

const fenced = (world: World, index: number, stamp: Stamp, stone: string): void => {
  const { grid } = world;
  for (const tile of world.structures.stations) {
    if (world.structures.built[tile] !== index + 1) continue;
    const middle = grid.centre(tile);
    if (!stamp.seen(middle.x, middle.y)) continue;
    const column = grid.columnOf(tile);
    const row = grid.rowOf(tile);
    for (const [side, [dx, dy]] of FENCE_SIDES.entries()) {
      const next = grid.at(column + dx, row + dy);
      if (next !== NOWHERE && world.structures.built[next] === index + 1) continue;
      for (let at = 0; at < FENCE_STONES; at += 1) {
        const along = (at - (FENCE_STONES - 1) / 2) * FENCE_GAP + (hash2(tile, side * 8 + at, 31) - 0.5) * 0.12;
        const out = (hash2(tile, side * 8 + at, 37) - 0.5) * 0.14;
        stamp.place(stone, middle.x + dx * (0.5 + out) - dy * along, middle.y + dy * (0.5 + out) + dx * along, hash2(tile, side * 8 + at, 41) > 0.5);
      }
    }
  }
};

export const structures: Drawable = {
  id: 'structures',
  order: 10,
  draw(world, _people, stamp) {
    const { grid } = world;
    for (const [index, def] of STATIONS.entries()) {
      if (def.fence) {
        if (stamp.has(`item.${def.fence}.s0`)) fenced(world, index, stamp, `item.${def.fence}.s0`);
        continue;
      }
      if (!stamp.has(def.sprite)) continue;
      for (const tile of world.structures.stations) {
        if (world.structures.built[tile] !== index + 1) continue;
        const at = middleOf(world, tile);
        if (stamp.seen(at.x, at.y)) stamp.place(def.sprite, at.x, at.y);
      }
    }

    for (const [index, def] of BLOCKS.entries()) {
      if (!stamp.has(def.sprite)) continue;
      for (const tile of world.structures.blocks) {
        if (world.structures.block[tile] !== STATIONS.length + index + 1) continue;
        const at = grid.centre(tile);
        if (stamp.seen(at.x, at.y)) stamp.place(def.sprite, at.x, at.y);
      }
    }

    const outlined = stamp.has('marker.plan');
    for (const anchor of world.structures.plans) {
      const def = buildableOfPlan(world.structures.plan[anchor]!);
      const art = def ? def.sprite : 'campfire.base';
      const cells = world.structures.tilesOf(anchor).map((cell) => grid.centre(cell));
      if (outlined) for (const at of cells) if (stamp.seen(at.x, at.y)) stamp.place('marker.plan', at.x, at.y);
      if (!stamp.has(art) || cells.length === 0 || (def && def.fence)) continue;
      const at = middleOf(world, anchor);
      if (stamp.seen(at.x, at.y)) stamp.place(art, at.x, at.y);
    }

    if (stamp.ghost) stamp.place(stamp.ghost.sprite, stamp.ghost.x, stamp.ghost.y);
  },
};
