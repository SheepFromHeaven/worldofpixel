import { config as humanConfig } from '../../animals/human/config.ts';
import { AMBIENT, EMISSION, SURROUNDINGS } from '../capabilities.ts';
import { provide, system } from '../kernel/kernel.ts';
import type { PeopleEnvironment } from '../people/people.ts';
import { ItemType } from '../people/items.ts';
import type { EmitterSource } from '../sources/emitters.ts';
import { BURNING_BRANCH, HELD_IDS, HELD_TORCH } from '../sources/emitters.ts';
import { peopleSystem } from '../systems/people.ts';
import { DEFAULT_RADIUS, listingsOf } from './listing.ts';
import { defineModule } from './module.ts';

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

export const peopleModule = defineModule('people', [surroundings, peopleSystem], { emitters: [carried], listings: humans, kind: { group: 'human', title: 'people' } });
