import { devModule, modulesWith } from '../src/sim/modules/index.ts';
import { Simulation } from '../src/sim/simulation.ts';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const seed = Number(flag('seed') ?? 20250214);
const extra = (flag('with') ?? '').split(',').filter(Boolean);
const commands = args.filter((arg) => !arg.startsWith('--'));

const started = performance.now();
const sim = new Simulation(seed, 'discover', null, null, [...modulesWith(extra), devModule]);
console.log(`world ${seed} in ${((performance.now() - started) / 1000).toFixed(1)} s, systems ${sim.kernel.order.join(' > ')}`);

for (const text of commands) {
  const [name = '', ...pairs] = text.split(/\s+/);
  const params = Object.fromEntries(pairs.map((pair) => { const [key = '', value = ''] = pair.split('='); return [key, Number.isNaN(Number(value)) ? value : Number(value)]; }));
  const began = performance.now();
  const result = sim.kernel.run(name, params);
  console.log(`${text} (${((performance.now() - began) / 1000).toFixed(1)} s)`, JSON.stringify(result));
}
