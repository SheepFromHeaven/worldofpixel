import type { TileIndex } from '../grid.ts';
import type { Random } from '../rng.ts';
import type { World } from '../world.ts';
import { Cover } from '../world.ts';
import { ItemType } from './items.ts';

const SCATTER: readonly (readonly [ItemType, number])[] = [
  [ItemType.Flint, 4],
  [ItemType.Stone, 3],
  [ItemType.DryKindling, 2],
  [ItemType.Branch, 2],
];

const NEAREST_TILES = 3;

const FARTHEST_TILES = 9;

export function scatterStarterItems(world: World, middle: TileIndex, random: Random): void {
  const { grid } = world;
  const column = grid.columnOf(middle);
  const row = grid.rowOf(middle);
  const span = FARTHEST_TILES - NEAREST_TILES;

  for (const [kind, wanted] of SCATTER) {
    let placed = 0;
    for (let attempt = 0; attempt < 200 && placed < wanted; attempt += 1) {
      const angle = random() * Math.PI * 2;
      const reach = NEAREST_TILES + random() * span;
      const tile = grid.at(column + Math.round(Math.cos(angle) * reach), row + Math.round(Math.sin(angle) * reach));
      if (!world.passable(tile) || world.coverOf(tile) === Cover.Tree) continue;
      if (world.items.add(tile, kind) >= 0) placed += 1;
    }
  }
}
