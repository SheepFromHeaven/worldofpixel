import { DAY_SECONDS } from '../../src/sim/calendar.ts';
import { EntityState } from '../../src/modules/people/api.ts';
import { Run } from './harness.ts';
import type { Scenario } from './harness.ts';

export const thirst: Scenario = {
  name: 'thirst',
  summary: 'one person on bare meadow with no water and no fire does not live through the second day',
  start: () => Run.stage({ humans: [[0, 0]] }),
  run(run) {
    const { people } = run;
    run.until('the person dies', () => people.state[0] === EntityState.Dead, DAY_SECONDS * 2);
    run.expect('they were thirsty', people.thirst[0]! >= 1, `${people.thirst[0]!.toFixed(2)}`);
  },
};
