import { AMBIENT, WORLD } from '../../sim/capabilities.ts';
import { PEOPLE } from '../people/api.ts';
import { system } from '../../sim/kernel/kernel.ts';
import { FoodSources } from './foodSources.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const food = system({
  id: 'food',
  needs: { world: WORLD, people: PEOPLE, ambient: AMBIENT },
  create: ({ world, people, ambient }) => {
    const sources = new FoodSources(world, people, world.seed, ambient);
    return { update: ({ scaled }) => sources.update(scaled) };
  },
});

export const foodModule = defineModule('food', [food], { order: 110 });
