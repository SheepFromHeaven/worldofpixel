import { DAY_SECONDS } from '../../src/sim/calendar.ts';
import type { Scenario } from './harness.ts';

export const winter: Scenario = {
  name: 'winter',
  summary: 'two people are fed and sheltered through the first winter and a third is born',
  target: true,
  run(run) {
    const { people } = run.sim;
    const pick = run.pursue('flame');
    run.until('fire is discovered', () => people.knowledge.hasDiscoveredFire, 3000, pick);
    run.expect('a fire is burning', run.sim.world.structures.fires.length > 0);
    run.advance(DAY_SECONDS);
    run.expect('both are alive', people.count === 2);
    run.expect('a third person is born', people.count >= 3, `${people.count} people`);
  },
};
