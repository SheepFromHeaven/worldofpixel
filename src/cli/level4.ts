
import type { LevelResult, Logger } from './harness.ts';
import { harness, play } from './harness.ts';
import { header } from './render.ts';

export function runLevel4(log: Logger): LevelResult {
  log(header('LEVEL 4 — Determinism: one seed, one trace'));
  const first = harness();
  const second = harness();
  play(first, 400, () => {});
  play(second, 400, () => {});

  const a = first.engine.traceHash();
  const b = second.engine.traceHash();
  log(`  run A hash ${a.toString(16)}`);
  log(`  run B hash ${b.toString(16)}`);

  const passed = a === b && first.events.length === second.events.length;
  return {
    id: 'level-4',
    title: 'Determinism',
    passed,
    detail: passed ? `both runs ended on ${a.toString(16)}` : `${a.toString(16)} ≠ ${b.toString(16)}`,
  };
}
