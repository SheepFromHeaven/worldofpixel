import { COVER_NAMES } from '../sim/covers.ts';
import type { TileIndex } from '../sim/grid.ts';
import { ITEM_NAMES } from '../sim/people/items.ts';
import type { StageSim } from '../sim/stageSim.ts';
import type { TileCommand } from '../sim/simulation.ts';
import { BIOME_NAMES } from '../sim/types.ts';
import type { RadialHost } from '../ui/radialSlices.ts';

export function stageHost(sim: StageSim, note: (text: string) => void): RadialHost {
  const tile = (kind: TileCommand) => (index: TileIndex): void => sim.apply({ kind, tile: index });
  const { world } = sim;
  return {
    world,
    people: sim.people,
    depth: 0,
    mode: 'settle',
    deepCaveAt: () => false,
    clearStorage: tile('clearStorage'),
    clearFloor: tile('clearFloor'),
    designateStorage: tile('designateStorage'),
    layFloor: tile('layFloor'),
    experiment: tile('experiment'),
    bringHere: tile('bringHere'),
    cancelPlan: tile('cancelPlan'),
    planRelight: tile('planRelight'),
    planCampfire: tile('planCampfire'),
    addFuel: tile('addFuel'),
    lightTorch: tile('lightTorch'),
    plantTorch: tile('plantTorch'),
    chopWood: tile('chopWood'),
    pickUp: (index, item) => sim.apply({ kind: 'pickUp', tile: index, item }),
    openTile: (index) => {
      const column = world.grid.columnOf(index);
      const row = world.grid.rowOf(index);
      const lying = world.items.kindsAt(index).map((kind) => ITEM_NAMES[kind] ?? 'item');
      note(`tile ${column}, ${row}: ${BIOME_NAMES[world.biome[index]!]}, ${COVER_NAMES[world.cover[index]!]}, wear ${world.wear[index]}${lying.length > 0 ? `, ${lying.join(' and ')}` : ''}`);
    },
  };
}
