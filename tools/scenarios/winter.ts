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
    const near = [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 1], [-3, -1], [1, 3], [-1, -3], [4, 0], [-4, 0]].map(([dx, dy]) => grid.at(grid.columnOf(here) + dx!, grid.rowOf(here) + dy!));
    for (const tile of near) {
      if (!run.labels(tile).includes('Erect > Campfire')) continue;
      run.choose(tile, 'Erect', 'Campfire');
      if (run.world.structures.isPlanned(tile)) break;
    }
    run.until('a fire is burning', () => run.world.structures.fires.length > 0, 600, pick);
    let tended = -Infinity;
    const tend = (): void => {
      pick();
      if (run.seconds - tended < 20) return;
      tended = run.seconds;
      for (const tile of run.world.structures.fires) {
        const add = run.slices(tile).find((slice) => slice.label === 'Add Fuel');
        if (add && add.reason === null && run.world.structures.fuelAt(tile) < 250) add.run();
      }
    };
    run.until('a third person is born', () => people.count >= 3, DAY_SECONDS * 3, tend);
    run.expect('nobody died', livingOf(people).length === people.count, `${livingOf(people).length} living of ${people.count}`);
  },
};
