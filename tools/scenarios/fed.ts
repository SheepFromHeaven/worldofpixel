import { DAY_SECONDS } from '../../src/sim/calendar.ts';
import { livingOf } from '../../src/modules/people/api.ts';
import type { Scenario } from './harness.ts';

export const fed: Scenario = {
  name: 'fed',
  summary: 'two people left alone by a fire feed themselves for four days',
  run(run) {
    const { people, world } = run;
    const pick = run.pursue('flame');
    run.until('fire is discovered', () => people.knowledge.hasDiscoveredFire, 3000, pick);
    const here = world.grid.atPoint({ x: people.posX[0]!, y: people.posY[0]! });
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 1], [-3, -1]]) {
      const tile = world.grid.at(world.grid.columnOf(here) + dx!, world.grid.rowOf(here) + dy!);
      if (!run.labels(tile).includes('Erect > Campfire')) continue;
      run.choose(tile, 'Erect', 'Campfire');
      if (world.structures.isPlanned(tile)) break;
    }
    let hungriest = 0;
    const end = run.seconds + DAY_SECONDS * 4;
    while (run.seconds < end) {
      run.advance(1);
      for (let person = 0; person < people.count; person += 1) hungriest = Math.max(hungriest, people.hunger[person]!);
    }
    run.expect('nobody died', livingOf(people).length === people.count, `${livingOf(people).length} living of ${people.count}`);
    run.expect('nobody went past ravenous', hungriest < 0.7, `hungriest ${hungriest.toFixed(2)}`);
  },
};
