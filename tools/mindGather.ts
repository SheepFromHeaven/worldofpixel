import { Simulation } from '../src/sim/simulation.ts';
import { ItemType } from '../src/sim/people/items.ts';

const sim = new Simulation(20250214, 'settle', null);
const { world, people } = sim;
sim.apply({ kind: 'setSeason', phase: 0.62 });
sim.advance(0.05);
const at = people.tileOf(0);
const column = world.grid.columnOf(at);
const row = world.grid.rowOf(at);
const spots = [world.grid.at(column + 3, row + 1), world.grid.at(column + 4, row + 1), world.grid.at(column + 5, row + 1)];
for (const spot of spots) world.designate(spot);
const fire = world.grid.at(column - 4, row);
world.kindle(fire, 300);
const tally = (): string => {
  const counts = new Map<number, number>();
  for (const spot of spots) for (const slot of world.items.at(spot)) counts.set(world.items.kind[slot]!, (counts.get(world.items.kind[slot]!) ?? 0) + 1);
  return [...counts].map(([kind, count]) => `${kind === ItemType.Berries ? 'berries' : kind === ItemType.Grubs ? 'grubs' : kind === ItemType.Egg ? 'eggs' : kind === ItemType.Roast ? 'roast' : kind} ${count}`).join(', ') || 'nothing';
};
console.log('gather on');
sim.apply({ kind: 'gather', on: true });
for (let tick = 0; tick < 3000; tick += 1) {
  people.hunger.fill(0);
  sim.advance(0.1);
  if (tick % 1000 === 999) console.log(`${((tick + 1) / 10).toFixed(0)}s stored: ${tally()}`);
}
sim.apply({ kind: 'gather', on: false });
console.log('roast');
world.items.add(world.grid.at(column + 1, row + 2), ItemType.Egg);
sim.apply({ kind: 'roast', tile: fire });
for (let tick = 0; tick < 900; tick += 1) {
  people.hunger.fill(0);
  sim.advance(0.1);
  if (tick % 300 === 299) console.log(`${((tick + 1) / 10).toFixed(0)}s stored: ${tally()}`);
}
console.log('finished');
