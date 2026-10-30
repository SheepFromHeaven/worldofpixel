import { EMISSION, EMITTER_SOURCES, PEOPLE, WORLD } from '../capabilities.ts';
import { provide, system } from '../kernel/kernel.ts';
import { buildingOf } from '../../content/buildings/index.ts';
import { Emission } from '../sources/emission.ts';
import type { EmitterSource } from '../sources/emitters.ts';
import { BUILDING_IDS, kindOf } from '../sources/emitters.ts';
import { fireLevel } from '../sources/fuel.ts';
import { defineModule } from './module.ts';

const emission = system({
  id: 'emission',
  needs: { world: WORLD, people: PEOPLE, sources: EMITTER_SOURCES },
  create: ({ world, people, sources }) => ({ provides: [provide(EMISSION, new Emission(sources, world, people))] }),
});

const OCCUPIED_WITHIN_TILES = 3;

const fromBuildings: EmitterSource = (world, people, out) => {
  const { grid, structures } = world;
  for (const tile of structures.buildings) {
    const def = buildingOf(structures.built[tile]!);
    const emits = def?.emits;
    if (!emits) continue;
    const at = grid.centre(tile);
    if (emits.when === 'lit' && structures.fire[tile] !== 1) continue;
    if (emits.when === 'occupied') {
      let occupied = false;
      for (let person = 0; person < people.count && !occupied; person += 1) occupied = people.isLying(person) && Math.hypot(people.posX[person]! - at.x, people.posY[person]! - at.y) <= OCCUPIED_WITHIN_TILES;
      if (!occupied) continue;
    }
    out.push({ id: BUILDING_IDS + tile, kind: kindOf(emits), x: at.x, y: at.y, level: def.fuelled ? fireLevel(structures.fuelAt(tile)) : 1 });
  }
};

export const lightModule = defineModule('light', [emission], { emitters: [fromBuildings] });
