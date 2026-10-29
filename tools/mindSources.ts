import { Simulation } from '../src/sim/simulation.ts';
import { ItemType } from '../src/sim/people/items.ts';

const SEEDS = [20250214];
for (const seed of SEEDS) {
  const sim = new Simulation(seed, 'settle', null);
  const { world, people } = sim;
  sim.apply({ kind: 'setSeason', phase: 0.62 });
  sim.advance(0.05);
  for (let slot = world.items.used - 1; slot >= 0; slot -= 1) if ([ItemType.Berries, ItemType.Grubs, ItemType.Egg].includes(world.items.kind[slot] as never)) world.items.remove(slot);
  const counts = (): string => [ItemType.Berries, ItemType.Grubs, ItemType.Egg].map((kind) => {
    let found = 0;
    for (let slot = 0; slot < world.items.used; slot += 1) if (world.items.kind[slot] === kind) found += 1;
    return found;
  }).join('/');
  for (let tick = 0; tick < 6000; tick += 1) {
    people.hunger.fill(0);
    sim.advance(0.1);
    if (tick % 1500 === 1499) console.log(`seed ${seed} ${((tick + 1) / 10).toFixed(0)}s berries/grubs/eggs ${counts()}`);
  }
}
console.log('finished');
