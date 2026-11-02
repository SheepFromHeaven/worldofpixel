import { createHash } from 'node:crypto';
import { ANIMALS } from '../src/modules/mammals/api.ts';
import { FAUNA } from '../src/modules/fauna/api.ts';
import { Simulation } from '../src/sim/simulation.ts';

const seed = Number(process.env.SEED ?? 20250214);
const steps = Number(process.env.STEPS ?? 600);
const sim = new Simulation(seed, 'settle', null);
const hash = (value: string | ArrayBufferView): string => {
  const bytes = typeof value === 'string' ? Buffer.from(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return createHash('sha1').update(bytes).digest('hex').slice(0, 10);
};

sim.apply({ kind: 'setSpeed', speed: 3 });
const started = process.cpuUsage();
for (let step = 0; step < steps; step += 1) sim.advance(0.1);
const used = process.cpuUsage(started);
const state = sim.snapshot();
console.log(`seed ${seed} steps ${steps}`, {
  people: hash(JSON.stringify(state.people)),
  world: hash(JSON.stringify(state.world)),
  mind: hash(JSON.stringify(state.mind)),
  calendar: hash(JSON.stringify(state.calendar)),
  fauna: hash(sim.kernel.get(FAUNA).stock),
  animals: hash(sim.kernel.get(ANIMALS).store.posX),
  playTime: sim.playTime.toFixed(4),
});
console.log(`advance cpu ${((used.user + used.system) / 1000 / steps).toFixed(3)} ms a step`);
