import { neuronIndex } from '../../src/modules/mind/api.ts';
import { ItemType } from '../../src/modules/items/api.ts';
import { Run } from './harness.ts';
import type { Scenario } from './harness.ts';

export const storage: Scenario = {
  name: 'storage',
  summary: 'four stones and a weed-covered site: the site is cleared, the stones gathered, the storage built, then razed for its stones',
  start: () =>
    Run.stage({
      humans: [[0, 0]],
      items: [[3, 0, ItemType.Stone, 4]],
    }),
  run(run) {
    run.mind.learn(neuronIndex('stone'), 0);
    const site = run.tile(-3, 0);
    run.world.plants.herb[site] = 1;
    run.world.plants.syncCover(site);
    run.choose(site, 'Erect', 'Storage');
    run.expect('the plan is recorded', run.world.structures.plans.length === 1);
    run.until('the site is cleared', () => !run.world.plants.occupied(site), 60);
    run.expect('nothing is built yet', run.world.structures.built[site] === 0);
    run.until('the storage stands', () => run.world.structures.isStorage(site), 180);
    run.expect('the stones were spent', run.world.items.tally(site, ItemType.Stone) === 0);
    run.choose(site, 'Take Down Storage');
    run.expect('it still stands while the work is done', run.world.structures.isStorage(site));
    run.until('it is razed', () => !run.world.structures.isStorage(site), 120);
    run.expect('four stones are recovered', run.world.items.tally(site, ItemType.Stone) === 4);
  },
};

export const seekStones: Scenario = {
  name: 'seekStones',
  summary: 'no stone lies anywhere: the builder goes looking for four and the storage is built from what is found',
  start: () => Run.stage({ humans: [[0, 0]], items: [] }),
  run(run) {
    run.mind.learn(neuronIndex('stone'), 0);
    const site = run.tile(-3, 0);
    run.choose(site, 'Erect', 'Storage');
    run.until('the storage stands', () => run.world.structures.isStorage(site), 1500);
  },
};
