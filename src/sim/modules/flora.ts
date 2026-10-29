import { DAY_SECONDS } from '../calendar.ts';
import { CALENDAR, WORLD } from '../capabilities.ts';
import { NOWHERE } from '../grid.ts';
import { system } from '../kernel/kernel.ts';
import { defineModule } from './module.ts';

const flora = system({
  id: 'flora',
  needs: { world: WORLD, calendar: CALENDAR },
  tags: ['nature'],
  create: ({ world, calendar }) => {
    world.plants.phase = calendar.seasonPhase;
    return {
      update: ({ scaled }) => {
        if (scaled > 0) world.grow(scaled / DAY_SECONDS, calendar.seasonPhase);
        world.plants.phase = calendar.seasonPhase;
      },
      commands: {
        'use.clear': ({ tile }: { tile: number }) => tile !== NOWHERE && (world.clear(tile), true),
        'use.uproot': ({ tile }: { tile: number }) => tile !== NOWHERE && (world.fell(tile), true),
      },
    };
  },
});

export const floraModule = defineModule('flora', [flora]);
