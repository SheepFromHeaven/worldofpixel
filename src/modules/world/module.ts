import { openingSpot } from '../../sim/spot.ts';
import { SEED, SPOT, WORLD } from '../../sim/capabilities.ts';
import { layersOf } from '../../sim/layers/provide.ts';
import { provide, system } from '../../sim/kernel/kernel.ts';
import { World } from '../../sim/world.ts';
import { defineModule } from '../../sim/kernel/module.ts';

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

export const worldModule = defineModule('world', [world], { order: 10 });
