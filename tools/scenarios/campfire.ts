import { ItemType } from '../../src/modules/items/api.ts';
import { Run } from './harness.ts';
import type { Scenario } from './harness.ts';

export const campfire: Scenario = {
  name: 'campfire',
  summary: 'one person, three branches and a burning branch on bare meadow: plan a campfire and it is built',
  start: () =>
    Run.stage({
      humans: [[0, 0]],
      items: [
        [3, 0, ItemType.Branch, 3],
        [0, 3, ItemType.BurningBranch],
      ],
    }),
  run(run) {
    const site = run.tile(-3, 0);
    run.choose(site, 'Erect', 'Campfire');
    run.expect('the plan is recorded', run.world.structures.plans.length === 1);
    run.until('a campfire is burning', () => run.world.structures.fires.length > 0, 180);
    run.expect('it is on the planned tile', run.world.structures.isFire(site));
    run.expect('fire is discovered', run.people.knowledge.hasDiscoveredFire);
  },
};
