import { Simulation } from '../src/sim/simulation.ts';
import { neuronIndex } from '../src/sim/mind/neurons.ts';
import { ITEM_NAMES, ItemType } from '../src/sim/people/items.ts';

const sim = new Simulation(20250214, 'settle', null);
const { mind, people, world } = sim;
const log = (text: string): void => console.log(`[${sim.playTime.toFixed(0).padStart(5)}s] ${text}`);
sim.advance(0.05);
for (let person = 0; person < people.count; person += 1) mind.learn(person, neuronIndex('flame'), 2);
const guesses: readonly (readonly [string, string])[] = [['fibre', 'fibre'], ['cord', 'fibre'], ['flame', 'egg']];
let next = 0;
const count = (kind: number): number => {
  let found = 0;
  for (let slot = 0; slot < world.items.used; slot += 1) if (world.items.kind[slot] === kind) found += 1;
  for (let person = 0; person < people.count; person += 1) if (people.heldItemType[person] === kind) found += 1;
  return found;
};
for (let tick = 0; tick < 9000; tick += 1) {
  sim.advance(0.1);
  if (tick % 50 === 0 && next < guesses.length) {
    const [a, b] = guesses[next]!;
    const ia = neuronIndex(a);
    const ib = neuronIndex(b);
    if (mind.anyone(ia) && mind.anyone(ib) && !mind.open().length) {
      const refused = mind.wonder(ia, ib);
      log(`wonder ${a} + ${b}: ${refused ?? 'ok'}`);
      if (refused === null) next += 1;
    }
  }
  if (tick % 300 === 0) log(`${mind.hypotheses.map((h) => `${h.id}:${h.state}/${h.note}`).join(' ')} | cord ${count(ItemType.Cord)} basket ${count(ItemType.Basket)} roast ${count(ItemType.Roast)} fibre ${count(ItemType.PlantFibre)} hunger ${people.hunger[0]!.toFixed(2)}`);
}
log(`items: ${[ItemType.Berries, ItemType.Grubs, ItemType.Egg, ItemType.Cord, ItemType.Basket, ItemType.Roast].map((kind) => `${ITEM_NAMES[kind]} ${count(kind)}`).join(', ')}`);
