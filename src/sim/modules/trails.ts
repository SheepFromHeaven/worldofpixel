import { TRAILS } from '../capabilities.ts';
import { NOWHERE } from '../grid.ts';
import { system } from '../kernel/kernel.ts';
import { fadeSystem } from '../systems/people.ts';
import { defineModule } from './module.ts';

const TREAD_WEAR = 48;

const treading = system({
  id: 'treading',
  needs: { trails: TRAILS },
  create: ({ trails }) => ({
    commands: { 'use.tread': ({ tile }: { tile: number }) => tile !== NOWHERE && (trails.tread(tile, TREAD_WEAR), true) },
  }),
});

export const trailsModule = defineModule('trails', [fadeSystem, treading]);
