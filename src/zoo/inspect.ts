import { COVER_NAMES } from '../sim/covers.ts';
import type { TileIndex } from '../sim/grid.ts';
import { ITEM_NAMES } from '../sim/people/items.ts';
import { BIOME_NAMES } from '../sim/types.ts';
import type { World } from '../sim/world.ts';

export function describeTile(world: World, index: TileIndex): string {
  const lying = world.items.kindsAt(index).map((kind) => ITEM_NAMES[kind] ?? 'item');
  return `tile ${world.grid.columnOf(index)}, ${world.grid.rowOf(index)}: ${BIOME_NAMES[world.biome[index]!]}, ${COVER_NAMES[world.cover[index]!]}, wear ${world.trails.wear[index]}${lying.length > 0 ? `, ${lying.join(' and ')}` : ''}`;
}
