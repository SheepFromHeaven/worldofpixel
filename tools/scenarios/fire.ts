import type { Scenario } from './harness.ts';

export const fire: Scenario = {
  name: 'fire',
  summary: 'two people with a player who only picks neurons discover fire',
  run(run) {
    const { people } = run.sim;
    const pick = run.pursue('flame');
    run.until('fire is discovered', () => people.knowledge.hasDiscoveredFire, 3000, pick);
  },
};
