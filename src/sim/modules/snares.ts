import { FAUNA, SNARES, WORLD } from '../capabilities.ts';
import { provide, system } from '../kernel/kernel.ts';
import { Snares } from '../people/snares.ts';
import { defineModule } from './module.ts';

const snares = system({
  id: 'snares',
  needs: { world: WORLD, fauna: FAUNA },
  tags: ['fauna'],
  create: ({ world, fauna }) => {
    const traps = new Snares(world, fauna, world.seed);
    return { provides: [provide(SNARES, traps)], update: ({ scaled }) => traps.update(scaled) };
  },
});

export const snaresModule = defineModule('snares', [snares]);
