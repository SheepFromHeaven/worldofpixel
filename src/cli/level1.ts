import { workOpen } from '../sim/chapter.ts';
import { LogisticsEngine } from '../sim/engine.ts';
import { DAY_TICKS, vesselsHeld } from '../sim/needs.ts';
import type { TickEvent } from '../sim/types.ts';
import { generateWorld } from '../sim/worldgen.ts';

import type { LevelResult, Logger } from './harness.ts';
import { SEED, foundBesideWater, harness, meanTicks, play, watchNeeds } from './harness.ts';
import { header } from './render.ts';

export function runLevel1(log: Logger): LevelResult {
  log(header('LEVEL 1 — The water hole: what a well buys, which is time and not water'));

  const fresh = generateWorld(SEED);
  const camp = { engine: new LogisticsEngine(fresh), settlement: foundBesideWater(fresh).settlement, events: [] as TickEvent[] };
  const camped = watchNeeds(camp, DAY_TICKS * 2).errands.filter((e) => e.kind === 'drink');
  log(`  camped at the river: ${camped.length} drinks, ${meanTicks(camped)} ticks each, every one at the bank`);

  const run = harness();
  const { settlement } = run;
  play(run, 10000, log, 2000);
  const sunk = watchNeeds(run, DAY_TICKS * 2).errands.filter((e) => e.kind === 'drink');
  const stored = sunk.filter((e) => e.easy);
  log(`  with the hole sunk: ${sunk.length} drinks, ${stored.length} out of a store, ${meanTicks(stored)} ticks each`);

  const sited = settlement.buildings.get(run.well.id) !== undefined;
  const wasStepEleven = workOpen(settlement, 'well');
  const neededAVessel = vesselsHeld(settlement) > 0;
  const atTheBank = camped.length > 0 && camped.every((e) => !e.easy);
  const quicker = stored.length > 0 && meanTicks(stored) < meanTicks(camped);
  const walked = [...settlement.carriers.values()].every((carrier) => carrier.walked > 0);

  const checks: [string, boolean][] = [
    ['a water hole is sunk, and only once the chapter reached it', sited && wasStepEleven],
    ['which took a vessel first, because nobody fetches without one', neededAVessel],
    ['before it, every drink is a walk to the bank', atTheBank],
    ['after it, water stands in a store and a drink there is quicker', quicker],
    ['everybody walked', walked],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-1',
    title: 'The water hole',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `a drink took ${meanTicks(camped)} ticks at the bank and ${meanTicks(stored)} out of a store`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}
