import { ItemType } from '../../src/modules/items/api.ts';
import { Run } from './harness.ts';
import type { Scenario } from './harness.ts';

export const noFlame: Scenario = {
  name: 'noFlame',
  summary: 'the same clearing without the burning branch: the menu offers no campfire',
  start: () => Run.stage({ humans: [[0, 0]], items: [[3, 0, ItemType.Branch, 3]] }),
  run(run) {
    const offered = run.labels(run.tile(-3, 0));
    run.expect('the menu offers no campfire', !offered.includes('Erect > Campfire'), offered.join(', '));
  },
};
