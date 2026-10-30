import { MODE, SAVED, SPOT, WORLD } from '../../sim/capabilities.ts';
import { PEOPLE } from '../people/api.ts';
import { provide, system } from '../../sim/kernel/kernel.ts';
import { FRONTIER } from '../../sim/frontier.ts';
import { People } from '../people/api.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const population = system({
  id: 'population',
  needs: { world: WORLD, spot: SPOT, mode: MODE, saved: SAVED },
  create: ({ world, spot, mode, saved }) => {
    const people = new People(world, mode === 'settle' ? spot : null);
    if (mode === 'settle') world.movement.confine(world.grid.atPoint(spot), FRONTIER.walkers);
    if (saved) {
      world.restore(saved.world);
      people.restore(saved.people);
      people.endAllTrials();
    }
    return { provides: [provide(PEOPLE, people)], save: () => ({ people: people.snapshot() }) };
  },
});

export const populationModule = defineModule('population', [population], { order: 50 });
