import { PEOPLE, WORLD } from '../capabilities.ts';
import { system } from '../kernel/kernel.ts';
import { FoodSources } from '../people/foodSources.ts';
import { defineModule } from './module.ts';

const food = system({
  id: 'food',
  needs: { world: WORLD, people: PEOPLE },
  create: ({ world, people }) => {
    const sources = new FoodSources(world, people, world.seed);
    return { update: ({ scaled }) => sources.update(scaled) };
  },
});

export const foodModule = defineModule('food', [food]);
