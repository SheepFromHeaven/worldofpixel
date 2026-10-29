import { Simulation } from '../src/sim/simulation.ts';
import { neuronIndex, NEURONS } from '../src/sim/mind/neurons.ts';
import { ITEM_NAMES } from '../src/sim/people/items.ts';

const seed = Number(process.argv[2] ?? 20250214);
const sim = new Simulation(seed, 'settle', null);
const { mind, people } = sim;

const log = (text: string): void => console.log(`[${sim.playTime.toFixed(0).padStart(5)}s] ${text}`);
const chain = ['flint+flint', 'spark+kindling', 'ember+branch', 'flint+stone', 'stone+stone', 'spark+branch', 'flint+branch'];

const have = (person: number): string => NEURONS.filter((_, index) => mind.level(person, index) >= 1).map((neuron) => `${neuron.id}${mind.level(person, NEURONS.indexOf(neuron)) === 1 ? '?' : ''}`).join(',');

sim.advance(0.05);
for (let tick = 0; tick < 6000; tick += 1) {
  sim.advance(0.1);
  if (tick % 50 === 0) {
    for (const pair of chain) {
      const [a, b] = pair.split('+').map(neuronIndex) as [number, number];
      if (mind.tried(a, b) || !mind.anyone(a) || !mind.anyone(b)) continue;
      if (pair === 'flint+branch' && tick < 3000) continue;
      if (pair === 'stone+stone' && tick < 1500) continue;
      const error = mind.wonder(a, b);
      log(`wonder ${pair}: ${error ?? 'ok'}`);
      break;
    }
  }
  if (tick % 100 === 0) {
    const doing = [0, 1].map((p) => `${p}:state${people.state[p]} task${people.task[p]} wonder${people.wonder[p]} hold ${ITEM_NAMES[people.heldItemType[p]!]}`).join(' | ');
    log(`${doing} | A:${have(0)} E:${have(1)} | ${mind.hypotheses.map((h) => `${h.id}:${h.state}/${h.note}`).join(' ')}`);
  }
}
log(`fire ${people.knowledge.hasDiscoveredFire} axe ${people.knowledge.hasDiscoveredFlintKnapping} proven ${mind.achieved().join(',')}`);
