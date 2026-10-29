import { Simulation } from '../src/sim/simulation.ts';
import { ItemType } from '../src/sim/people/items.ts';

const sim = new Simulation(20250214, 'settle', null);
const { people, world } = sim;
const food = (): number => {
  let found = 0;
  for (let slot = 0; slot < world.items.used; slot += 1) if ([ItemType.Berries, ItemType.Grubs, ItemType.Egg].includes(world.items.kind[slot] as never)) found += 1;
  return found;
};
sim.advance(0.05);
people.hunger[0] = 0.8;
people.hunger[1] = 0.8;
console.log(`start food ${food()} hunger ${people.hunger[0]!.toFixed(2)}`);
for (let tick = 0; tick < 1500; tick += 1) {
  sim.advance(0.1);
  if (tick % 300 === 0) console.log(`${(tick / 10).toFixed(0)}s food ${food()} hunger ${people.hunger[0]!.toFixed(2)} ${people.hunger[1]!.toFixed(2)}`);
}
