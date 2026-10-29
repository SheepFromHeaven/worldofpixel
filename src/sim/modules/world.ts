import { openingSpot } from '../spot.ts';
import { SEED, SPOT, WORLD } from '../capabilities.ts';
import { layersOf } from '../layers/provide.ts';
import { provide, system } from '../kernel/kernel.ts';
import { World } from '../world.ts';
import { defineModule } from './module.ts';

const world = system({
  id: 'world',
  needs: { seed: SEED },
  create: ({ seed }) => {
    const ground = World.generate(seed);
    return {
      provides: [provide(WORLD, ground), provide(SPOT, openingSpot(ground)), ...layersOf(ground)],
      save: () => ({ world: ground.snapshot() }),
    };
  },
});

export const worldModule = defineModule('world', [world]);
