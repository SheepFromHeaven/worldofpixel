import { DAY_SECONDS } from '../../src/sim/calendar.ts';
import { livingOf } from '../../src/modules/people/api.ts';
import type { Scenario } from './harness.ts';

export const winter: Scenario = {
  name: 'winter',
  summary: 'two people are fed and sheltered through the first winter and a third is born',
  run(run) {
    const { people } = run;
    const pick = run.pursue('flame');
    run.until('fire is discovered', () => people.knowledge.hasDiscoveredFire, 3000, pick);
    const { grid } = run.world;
    const here = grid.atPoint({ x: people.posX[0]!, y: people.posY[0]! });
    const site = [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 1]].map(([dx, dy]) => grid.at(grid.columnOf(here) + dx!, grid.rowOf(here) + dy!)).find((tile) => run.labels(tile).includes('Erect > Campfire'));
    if (site !== undefined) run.choose(site, 'Erect', 'Campfire');
    run.until('a fire is burning', () => run.world.structures.fires.length > 0, 600, pick);
    run.until('a third person is born', () => people.count >= 3, DAY_SECONDS * 3, pick);
    run.expect('nobody died', livingOf(people).length === people.count, `${livingOf(people).length} living of ${people.count}`);
  },
};
