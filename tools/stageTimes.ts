import { fieldSteps } from '../src/sim/terrain/worldfield.ts';

const seed = Number(process.env.SEED ?? 20250214);
const cpu = (): number => {
  const usage = process.cpuUsage();
  return (usage.user + usage.system) / 1000;
};
const steps = fieldSteps(seed);
let t = cpu();
const rows: string[] = [];
let total = 0;
for (;;) {
  const step = steps.next();
  const now = cpu();
  const label = step.done ? 'return (weather, rivers, marks)' : step.value.label;
  rows.push(`  ${label.padEnd(34)} ${(now - t).toFixed(0).padStart(7)} ms`);
  total += now - t;
  t = now;
  if (step.done) {
    console.log(`${(step.value.grid.count / 1e6).toFixed(1)}M tiles, CPU time per stage (GC and background threads included)`);
    break;
  }
}
console.log(rows.join('\n'));
console.log(`  ${'total'.padEnd(34)} ${total.toFixed(0).padStart(7)} ms`);
