import { Simulation } from '../src/sim/simulation.ts';
import { neuronIndex, NEURONS } from '../src/sim/mind/neurons.ts';
import { ITEM_NAMES } from '../src/sim/people/items.ts';

const seed = Number(process.argv[2] ?? 20250214);
const sim = new Simulation(seed, 'settle', null);
const { mind, people } = sim;

const log = (text: string): void => console.log(`[${sim.playTime.toFixed(0).padStart(5)}s] ${text}`);
const fibres = ['spark:flint', 'spark:stone', 'spark:flint', 'sharp:flint', 'sharp:stone', 'ember:spark', 'ember:branch', 'ember:kindling', 'flame:ember', 'flame:branch'];

const have = (): string => NEURONS.filter((_, index) => mind.knows(index)).map((neuron) => neuron.id).join(',');
const cells = (): string =>
  [...mind.cells]
    .map(([index, cell]) => `${NEURONS[index]!.id}[${cell.attached.map((n) => NEURONS[n]!.id).join('+')}${cell.withered.length > 0 ? ` x${cell.withered.map((n) => NEURONS[n]!.id).join(',')}` : ''}]`)
    .join(' ');

let next = 0;
sim.advance(0.05);
for (let tick = 0; tick < 6000; tick += 1) {
  sim.advance(0.1);
  if (tick % 30 === 0 && next < fibres.length) {
    const [cell, parent] = fibres[next]!.split(':').map(neuronIndex) as [number, number];
    if (mind.stepOf(cell) !== 0 && mind.knows(parent) && mind.mindful()) {
      log(`attach ${fibres[next]}: ${mind.attach(cell, parent) ?? 'ok'} (weariness ${mind.weariness.toFixed(2)})`);
      next += 1;
    }
  }
  if (tick % 150 === 0) {
    const doing = [0, 1].map((p) => `${p}:state${people.state[p]} wonder${people.wonder[p]} hold ${ITEM_NAMES[people.heldItemType[p]!]}`).join(' | ');
    log(`${doing} | ${have()} | ${cells()} | ${mind.hypotheses.map((h) => `${h.id}:${NEURONS[h.result]!.id}/${h.note}`).join(' ')}`);
  }
}
log(`fire ${people.knowledge.hasDiscoveredFire} axe ${people.knowledge.hasDiscoveredFlintKnapping} proven ${mind.achieved().join(',')} places ${mind.places.size}`);
