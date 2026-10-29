import { NOWHERE } from '../sim/grid.ts';
import type { World } from '../sim/world.ts';
import { Building } from '../sim/world.ts';

export type StructureKind = 'campfire' | 'burnt' | 'storage' | 'floor' | 'torch' | 'plan' | 'bed' | 'hut' | 'snare';

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
  { kind: 'bed', title: 'bed', sprite: 'structure.bed' },
  { kind: 'hut', title: 'hut', sprite: 'structure.hut' },
  { kind: 'snare', title: 'snare', sprite: 'structure.snare' },
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
    case 'storage':
      return world.structures.designate(tile);
    case 'floor':
      return world.structures.layFloor(tile);
    case 'torch':
      return world.structures.plant(tile);
    case 'bed':
      return world.structures.raise(tile, Building.Bed);
    case 'hut':
      return world.structures.raise(tile, Building.Hut);
    case 'snare':
      return world.structures.raise(tile, Building.Snare);
  }
}

export function eraseStructures(world: World, tile: number): number {
  if (tile === NOWHERE) return 0;
  let removed = 0;
  for (const gone of [world.structures.extinguish(tile), world.structures.clearEmber(tile), world.structures.unplan(tile), world.structures.release(tile), world.structures.unfloor(tile), world.structures.pull(tile), world.structures.demolish(tile)]) if (gone) removed += 1;
  return removed;
}

export function structuresOf(world: World): [number, StructureKind][] {
  const found: [number, StructureKind][] = [];
  for (const tile of world.structures.fires) found.push([tile, 'campfire']);
  for (const tile of world.structures.embers) found.push([tile, 'burnt']);
  for (const tile of world.structures.plans) found.push([tile, 'plan']);
  for (const tile of world.structures.storageTiles) found.push([tile, 'storage']);
  for (const tile of world.structures.floors) found.push([tile, 'floor']);
  for (const tile of world.structures.torches) if (!world.structures.isDeepTorch(tile)) found.push([tile, 'torch']);
  for (const tile of world.structures.buildings) found.push([tile, world.structures.built[tile] === Building.Hut ? 'hut' : world.structures.built[tile] === Building.Snare ? 'snare' : 'bed']);
  return found;
}
