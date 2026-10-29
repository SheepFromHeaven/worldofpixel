import { EMISSION, EMITTER_SOURCES, PEOPLE, WORLD } from '../capabilities.ts';
import { provide, system } from '../kernel/kernel.ts';
import { Emission } from '../sources/emission.ts';
import { defineModule } from './module.ts';

const emission = system({
  id: 'emission',
  needs: { world: WORLD, people: PEOPLE, sources: EMITTER_SOURCES },
  create: ({ world, people, sources }) => ({ provides: [provide(EMISSION, new Emission(sources, world, people))] }),
});

export const lightModule = defineModule('light', [emission]);
