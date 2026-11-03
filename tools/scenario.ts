import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { campfire } from './scenarios/campfire.ts';
import { seekStones, storage } from './scenarios/storage.ts';
import { determinism } from './scenarios/determinism.ts';
import { fire } from './scenarios/fire.ts';
import { Run } from './scenarios/harness.ts';
import { noFlame } from './scenarios/noFlame.ts';
import type { Scenario } from './scenarios/harness.ts';
import { ages, kin } from './scenarios/lives.ts';
import { cold, frost, hunger, sleep, thirst } from './scenarios/needs.ts';
import { winter } from './scenarios/winter.ts';

const SCENARIOS: readonly Scenario[] = [determinism, campfire, storage, seekStones, noFlame, fire, thirst, hunger, cold, sleep, frost, kin, ages, winter];

const SEED = Number(process.env.SEED ?? 20250214);

const play = (scenario: Scenario): number => {
  const started = performance.now();
  const run = scenario.start?.() ?? Run.game(SEED);
  scenario.run(run);
  const passed = run.checks.every((check) => check.pass);
  const kind = scenario.target ? (passed ? 'REACHED' : 'target') : passed ? 'pass' : 'FAIL';
  console.log(`${kind.padEnd(7)} ${scenario.name}  ${((performance.now() - started) / 1000).toFixed(1)}s cpu, ${run.seconds.toFixed(0)}s played  (${scenario.summary})`);
  for (const check of run.checks) console.log(`          ${check.pass ? 'ok  ' : 'no  '} ${check.label}${check.detail ? `  ${check.detail}` : ''}`);
  return passed || scenario.target ? 0 : 1;
};

const named = process.argv.slice(2);
if (named.length > 0) {
  process.exit(SCENARIOS.filter((scenario) => named.includes(scenario.name)).reduce((failed, scenario) => failed + play(scenario), 0) > 0 ? 1 : 0);
}

const children = SCENARIOS.map(
  (scenario) =>
    new Promise<{ code: number; out: string }>((done) => {
      const child = spawn(process.execPath, [...process.execArgv, process.argv[1]!, scenario.name], { stdio: ['ignore', 'pipe', 'inherit'] });
      let out = '';
      child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
      child.on('close', (code) => done({ code: code ?? 1, out }));
    }),
);
const results = await Promise.all(children);
for (const result of results) process.stdout.write(result.out);
process.exit(results.some((result) => result.code !== 0) ? 1 : 0);
