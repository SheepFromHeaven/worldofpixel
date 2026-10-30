import { WORLD } from '../../sim/capabilities.ts';
import { provide, system } from '../../sim/kernel/kernel.ts';
import { defineModule } from '../../sim/kernel/module.ts';
import { HOMES } from './api.ts';
import './layer.ts';

const homes = system({
  id: 'homes',
  needs: { world: WORLD },
  create: ({ world }) => ({ provides: [provide(HOMES, world.homes)] }),
});

export const homesModule = defineModule('homes', [homes], { order: 15 });
