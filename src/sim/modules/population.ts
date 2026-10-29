import { MIND, MODE, PEOPLE, SAVED, SPOT, WORLD } from '../capabilities.ts';
import { provide, system } from '../kernel/kernel.ts';
import { Mind } from '../mind/mind.ts';
import { People } from '../people/people.ts';
import { defineModule } from './module.ts';

const CONFINE_TILES = 11;

const population = system({
  id: 'population',
  needs: { world: WORLD, spot: SPOT, mode: MODE, saved: SAVED },
  create: ({ world, spot, mode, saved }) => {
    const people = new People(world, mode === 'settle' ? spot : null);
    if (mode === 'settle') world.movement.confine(world.grid.atPoint(spot), CONFINE_TILES);
    if (saved) {
      world.restore(saved.world);
      people.restore(saved.people);
      people.endAllTrials();
    }
    return { provides: [provide(PEOPLE, people)], save: () => ({ people: people.snapshot() }) };
  },
});

const thinking = system({
  id: 'thinking',
  needs: { people: PEOPLE, saved: SAVED },
  create: ({ people, saved }) => {
    const mind = new Mind(people);
    people.mind = mind;
    if (saved?.mind) mind.restore(saved.mind);
    if (saved) people.endAllWonders();
    return { provides: [provide(MIND, mind)], save: () => ({ mind: mind.snapshot() }) };
  },
});

export const populationModule = defineModule('population', [population, thinking]);
