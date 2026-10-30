import { NOWHERE } from '../sim/grid.ts';
import type { World } from '../sim/world.ts';
import { BUILDABLES, buildableIdOf, buildableOf } from '../content/buildables.ts';
import { stationOf } from '../content/stations/index.ts';

export type StructureKind = string;

export interface StructureEntry {
  kind: StructureKind;
  title: string;
  sprite: string;
}

export const STRUCTURES: readonly StructureEntry[] = [
  { kind: 'campfire', title: 'campfire', sprite: 'campfire.base' },
  { kind: 'burnt', title: 'burnt campfire', sprite: 'campfire.burnt' },
  { kind: 'plan', title: 'campfire plan', sprite: 'marker.plan' },
  { kind: 'torch', title: 'standing torch', sprite: 'torch.post' },
  ...BUILDABLES.filter((def) => def.placedBy === null).map((def) => ({ kind: def.key, title: def.name.toLowerCase(), sprite: def.sprite })),
];

const STARTING_FUEL = 300;

export function placeStructure(world: World, tile: number, kind: StructureKind): boolean {
  if (tile === NOWHERE) return false;
  switch (kind) {
    case 'campfire':
      return world.structures.kindle(tile, STARTING_FUEL);
    case 'burnt':
      return world.structures.kindle(tile) && world.structures.extinguish(tile);
    case 'plan':
      return world.structures.planCampfire(tile);
    case 'torch':
      return world.structures.plant(tile);
    default:
      return world.structures.raise(tile, buildableIdOf(kind));
  }
}

export function eraseStructures(world: World, tile: number): number {
  if (tile === NOWHERE) return 0;
  let removed = 0;
  for (const gone of [world.structures.extinguish(tile), world.structures.clearEmber(tile), world.structures.unplan(tile), world.structures.pull(tile), world.structures.demolish(tile)]) if (gone) removed += 1;
  return removed;
}

export function structuresOf(world: World): [number, StructureKind][] {
  const found: [number, StructureKind][] = [];
  for (const tile of world.structures.fires) found.push([tile, 'campfire']);
  for (const tile of world.structures.embers) found.push([tile, 'burnt']);
  for (const tile of world.structures.plans) found.push([tile, 'plan']);
  for (const tile of world.structures.torches) if (!world.structures.isDeepTorch(tile)) found.push([tile, 'torch']);
  for (const tile of world.structures.stations) found.push([tile, stationOf(world.structures.built[tile]!)!.key]);
  for (const tile of world.structures.blocks) found.push([tile, buildableOf(world.structures.block[tile]!)!.key]);
  return found;
}
