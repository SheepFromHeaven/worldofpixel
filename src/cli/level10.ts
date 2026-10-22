import { clearingFor } from '../sim/clearing.ts';
import { parcelOf } from '../sim/terrain/parcels.ts';
import { Biome } from '../sim/types.ts';

import type { LevelResult, Logger } from './harness.ts';
import { MIDDLE, freeParcelsNear, harness, play } from './harness.ts';
import { header } from './render.ts';

export function runLevel10(log: Logger): LevelResult {
  log(header('LEVEL 10 — Clearing: a building is placed, then its site is felled and dug by hand'));
  const run = harness();
  const { world, settlement } = run;
  const hearth = settlement.buildings.get(settlement.hearthId)!;
  const dig = run.bank;
  const needed = dig.clearing?.needed ?? 0;

  const sites = freeParcelsNear(world, MIDDLE, 400).map((id) => parcelOf(world.seed, id));
  const forest = sites.find((p) => p.biome === Biome.Forest && p.neighbors.every((n) => parcelOf(world.seed, n).biome === Biome.Forest));
  const meadow = sites.find((p) => p.biome === Biome.Meadow && p.neighbors.every((n) => parcelOf(world.seed, n).biome === Biome.Meadow));
  const forestCost = forest ? clearingFor(world, forest.id).needed : 0;
  const meadowCost = meadow ? clearingFor(world, meadow.id).needed : 0;
  const bare = sites.find((p) => clearingFor(world, p.id).felling === 0);
  const bareWork = bare ? clearingFor(world, bare.id) : undefined;
  const forestWork = forest ? clearingFor(world, forest.id) : undefined;

  play(run, 10000, () => {});
  const cleared = run.events.find((e) => e.kind === 'cleared' && e.buildingId === dig.id);
  const usedEarly = run.events.some(
    (e) => e.buildingId === dig.id && e.kind !== 'cleared' && (!cleared || e.tick < cleared.tick),
  );
  const usedAfter = run.events.some((e) => e.buildingId === dig.id && e.kind === 'produced' && cleared && e.tick > cleared.tick);
  log(`  the dig needed ${needed} ticks of clearing, done on tick ${cleared?.tick ?? 'never'}; forest site ${forestCost}, meadow ${meadowCost}`);

  const checks: [string, boolean][] = [
    ['a building placed waits to be cleared', needed > 0],
    ['the hearth is up the moment it is set', hearth.clearing === null],
    ['a forest is more work to clear than a meadow', forestCost > meadowCost && meadowCost > 0],
    ['a site with no trees is only dug, never felled', bareWork !== undefined && bareWork.felling === 0 && bareWork.needed > 0],
    ['every site is dug as well as felled', forestWork !== undefined && forestWork.needed > forestWork.felling && forestWork.felling > 0],
    ['nothing is drawn or carried at a site before it is cleared', !usedEarly],
    ['a villager clears it, and it takes the work it needs', cleared !== undefined && cleared.tick >= needed],
    ['cleared, it is used', usedAfter],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-10',
    title: 'Clearing',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `dig cleared on tick ${cleared?.tick} after ${needed} ticks of felling; forest ${forestCost}, meadow ${meadowCost}`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}
