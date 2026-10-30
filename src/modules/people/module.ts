import { config as humanConfig } from '../../content/animals/species/people/human/config.ts';
import { AMBIENT } from '../../sim/capabilities.ts';
import { EMISSION } from '../light/api.ts';
import { SURROUNDINGS } from './api.ts';
import { provide, system } from '../../sim/kernel/kernel.ts';
import type { PeopleEnvironment } from './people.ts';
import { ItemType } from '../items/api.ts';
import type { EmitterSource } from '../fire/api.ts';
import { BURNING_BRANCH, HELD_IDS, HELD_TORCH } from '../fire/api.ts';
import { peopleSystem } from '../../sim/kernel/systems.ts';
import { DEFAULT_RADIUS, listingsOf } from '../../sim/kernel/listing.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const surroundings = system({
  id: 'surroundings',
  needs: { ambient: AMBIENT, emission: EMISSION },
  create: ({ ambient, emission }) => {
    const environment: PeopleEnvironment = {
      temperatureAt: (tile) => ambient.temperatureAt(tile),
      warmthAt: (x, y) => emission.warmthAt(x, y),
      gloomAt: (x, y) => ambient.gloomAt(x, y),
      lightNear: (x, y) => emission.lightSpotNear(x, y),
    };
    return { provides: [provide(SURROUNDINGS, environment)] };
  },
});

const carried: EmitterSource = (_world, people, out) => {
  for (let person = 0; person < people.count; person += 1) {
    const held = people.heldItemType[person];
    if (held === ItemType.Torch) out.push({ id: HELD_IDS + person, kind: HELD_TORCH, x: people.posX[person]!, y: people.posY[person]!, level: 1 });
    if (held === ItemType.BurningBranch) out.push({ id: HELD_IDS + person, kind: BURNING_BRANCH, x: people.posX[person]!, y: people.posY[person]!, level: 1 });
  }
};

const humans = listingsOf('human', [humanConfig], () => ({ speed: 1.3, reach: 20, rest: 4, roams: true, restless: false, radius: DEFAULT_RADIUS, length: humanConfig.length }));

export const peopleModule = defineModule('people', [surroundings, peopleSystem], { order: 60, stage: true, emitters: [carried], listings: humans, kind: { group: 'human', title: 'people' } });
