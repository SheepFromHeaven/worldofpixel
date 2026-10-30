import { TRAILS } from './api.ts';
import './layer.ts';
import { NOWHERE } from '../../sim/grid.ts';
import { system } from '../../sim/kernel/kernel.ts';
import { fadeSystem } from '../../sim/kernel/systems.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const TREAD_WEAR = 48;

const treading = system({
  id: 'treading',
  needs: { trails: TRAILS },
  create: ({ trails }) => ({
    commands: { 'use.tread': ({ tile }: { tile: number }) => tile !== NOWHERE && (trails.tread(tile, TREAD_WEAR), true) },
  }),
});

export const trailsModule = defineModule('trails', [fadeSystem, treading], { order: 260, stage: true });
