import { DAY_SECONDS } from '../../sim/calendar.ts';
import { CALENDAR, WORLD } from '../../sim/capabilities.ts';
import { NOWHERE } from '../../sim/grid.ts';
import { system } from '../../sim/kernel/kernel.ts';
import { defineModule } from '../../sim/kernel/module.ts';

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

export const floraModule = defineModule('flora', [flora], { order: 250 });
