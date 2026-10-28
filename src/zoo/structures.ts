import { NOWHERE } from '../sim/grid.ts';
import type { World } from '../sim/world.ts';

export type StructureKind = 'campfire' | 'burnt' | 'storage' | 'floor' | 'torch' | 'plan';

export interface StructureEntry {
  kind: StructureKind;
  title: string;
  sprite: string;
}

export const STRUCTURES: readonly StructureEntry[] = [
  { kind: 'campfire', title: 'campfire', sprite: 'campfire.base' },
  { kind: 'burnt', title: 'burnt campfire', sprite: 'campfire.burnt' },
  { kind: 'plan', title: 'campfire plan', sprite: 'marker.plan' },
  { kind: 'storage', title: 'storage', sprite: 'marker.storage' },
  { kind: 'floor', title: 'knapping floor', sprite: 'marker.floor' },
  { kind: 'torch', title: 'standing torch', sprite: 'torch.post' },
];

const STARTING_FUEL = 300;

export function placeStructure(world: World, tile: number, kind: StructureKind): boolean {
  if (tile === NOWHERE) return false;
  switch (kind) {
    case 'campfire':
      return world.kindle(tile, STARTING_FUEL);
    case 'burnt':
      return world.kindle(tile) && world.extinguish(tile);
    case 'plan':
      return world.planCampfire(tile);
    case 'storage':
      return world.designate(tile);
    case 'floor':
      return world.layFloor(tile);
    case 'torch':
      return world.plant(tile);
  }
}

export function eraseStructures(world: World, tile: number): number {
  if (tile === NOWHERE) return 0;
  let removed = 0;
  for (const gone of [world.extinguish(tile), world.clearEmber(tile), world.unplan(tile), world.release(tile), world.unfloor(tile), world.pull(tile)]) if (gone) removed += 1;
  return removed;
}

export function structuresOf(world: World): [number, StructureKind][] {
  const found: [number, StructureKind][] = [];
  for (const tile of world.fires) found.push([tile, 'campfire']);
  for (const tile of world.embers) found.push([tile, 'burnt']);
  for (const tile of world.plans) found.push([tile, 'plan']);
  for (const tile of world.storageTiles) found.push([tile, 'storage']);
  for (const tile of world.floors) found.push([tile, 'floor']);
  for (const tile of world.torches) if (!world.isDeepTorch(tile)) found.push([tile, 'torch']);
  return found;
}
