import { AMBIENT, PEOPLE, WORLD } from '../capabilities.ts';
import { system } from '../kernel/kernel.ts';
import { FoodSources } from '../people/foodSources.ts';
import { defineModule } from './module.ts';

const food = system({
  id: 'food',
  needs: { world: WORLD, people: PEOPLE, ambient: AMBIENT },
  create: ({ world, people, ambient }) => {
    const sources = new FoodSources(world, people, world.seed, ambient);
    return { update: ({ scaled }) => sources.update(scaled) };
  },
});

export const foodModule = defineModule('food', [food]);
