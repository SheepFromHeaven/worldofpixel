import { WORLD } from '../../sim/capabilities.ts';
import { EMITTER_SOURCES } from './api.ts';
import { EMISSION } from './api.ts';
import { PEOPLE } from '../people/api.ts';
import { provide, system } from '../../sim/kernel/kernel.ts';
import { stationOf } from '../../content/stations/index.ts';
import { Emission } from '../fire/api.ts';
import type { EmitterSource } from '../fire/api.ts';
import { STATION_IDS, kindOf } from '../fire/api.ts';
import { fireLevel } from '../fire/api.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const emission = system({
  id: 'emission',
  needs: { world: WORLD, people: PEOPLE, sources: EMITTER_SOURCES },
  create: ({ world, people, sources }) => ({ provides: [provide(EMISSION, new Emission(sources, world, people))] }),
});

const OCCUPIED_WITHIN_TILES = 3;

const fromStations: EmitterSource = (world, people, out) => {
  const { grid, structures } = world;
  for (const tile of structures.stations) {
    const def = stationOf(structures.built[tile]!);
    const emits = def?.emits;
    if (!emits) continue;
    const at = grid.centre(tile);
    if (emits.when === 'lit' && structures.fire[tile] !== 1) continue;
    if (emits.when === 'occupied') {
      let occupied = false;
      for (let person = 0; person < people.count && !occupied; person += 1) occupied = people.isLying(person) && Math.hypot(people.posX[person]! - at.x, people.posY[person]! - at.y) <= OCCUPIED_WITHIN_TILES;
      if (!occupied) continue;
    }
    out.push({ id: STATION_IDS + tile, kind: kindOf(emits), x: at.x, y: at.y, level: def.fuelled ? fireLevel(structures.fuelAt(tile)) : 1 });
  }
};

export const lightModule = defineModule('light', [emission], { order: 40, stage: true, emitters: [fromStations] });
