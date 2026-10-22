import { LogisticsEngine } from '../sim/engine.ts';
import { restoreWorld, saveWorld } from '../sim/save.ts';

import type { LevelResult, Logger } from './harness.ts';
import { harness, play } from './harness.ts';
import { header } from './render.ts';

export function runLevel12(log: Logger): LevelResult {
  log(header('LEVEL 12 — Saving: a world written down and read back is the same world'));
  const run = harness();
  play(run, 600, () => {});

  const written = JSON.parse(JSON.stringify(saveWorld(run.world, run.engine.tickCount))) as unknown;
  const read = restoreWorld(written, run.world.seed);
  if (!read) {
    return { id: 'level-12', title: 'Saving', passed: false, detail: 'the save would not read back' };
  }

  const restored = new LogisticsEngine(read.world);
  restored.tickCount = read.tick;

  const atRest = run.engine.traceHash() === restored.traceHash();

  play(run, 200, () => {});
  for (let i = 0; i < 200; i += 1) restored.tick();
  const afterwards = run.engine.traceHash() === restored.traceHash();

  const was = run.world.settlements.get(run.settlement.id);
  const now = read.world.settlements.get(run.settlement.id);
  const sameTown =
    was !== undefined &&
    now !== undefined &&
    was.buildings.size === now.buildings.size &&
    was.carriers.size === now.carriers.size &&
    was.name === now.name &&
    was.hearthId === now.hearthId;
  const sameLibrary = run.world.library.size === read.world.library.size;
  const sameGround = run.world.wear.size === read.world.wear.size;

  const refusesOtherSeeds = restoreWorld(written, run.world.seed + 1) === null;
  const refusesOtherVersions =
    restoreWorld({ ...(written as object), version: -1 }, run.world.seed) === null;

  log(`  ${now?.buildings.size ?? 0} buildings, ${now?.carriers.size ?? 0} carriers and ${read.world.wear.size} worn nodes read back on tick ${read.tick}`);
  log(`  hash ${run.engine.traceHash().toString(16)} after 200 more ticks on each side`);

  const checks: [string, boolean][] = [
    ['the restored world traces identically', atRest],
    ['and goes on tracing identically', afterwards],
    ['the town comes back whole', sameTown],
    ['the library comes back whole', sameLibrary],
    ['the worn ground comes back', sameGround],
    ['a save for another seed is refused', refusesOtherSeeds],
    ['a save from another version is refused', refusesOtherVersions],
  ];
  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-12',
    title: 'Saving',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `read back on tick ${read.tick} and still on the same trace 200 ticks later`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}
