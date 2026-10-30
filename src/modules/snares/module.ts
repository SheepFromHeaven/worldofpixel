import { WORLD } from '../../sim/capabilities.ts';
import { FAUNA } from '../fauna/api.ts';
import { SNARES } from './api.ts';
import { provide, system } from '../../sim/kernel/kernel.ts';
import { Snares } from './snares.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const snares = system({
  id: 'snares',
  needs: { world: WORLD, fauna: FAUNA },
  tags: ['fauna'],
  create: ({ world, fauna }) => {
    const traps = new Snares(world, fauna, world.seed);
    return { provides: [provide(SNARES, traps)], update: ({ scaled }) => traps.update(scaled) };
  },
});

export const snaresModule = defineModule('snares', [snares], { order: 120, heavy: true });
