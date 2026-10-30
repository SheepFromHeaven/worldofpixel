import { Run } from './harness.ts';
import type { Scenario } from './harness.ts';

export const determinism: Scenario = {
  name: 'determinism',
  summary: 'the same seed and the same play give the same game',
  run(run) {
    const again = new Run(run.seed);
    run.advance(120);
    again.advance(120);
    run.expect('two runs of one seed end identical', run.digest() === again.digest(), `${run.digest()} against ${again.digest()}`);
  },
};
