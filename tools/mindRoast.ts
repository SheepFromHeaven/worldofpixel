import { Simulation } from '../src/sim/simulation.ts';
import { EntityState, Task } from '../src/sim/people/people.ts';
import { ITEM_NAMES, ItemType } from '../src/sim/people/items.ts';

const sim = new Simulation(20250214, 'settle', null);
const { world, people } = sim;
sim.advance(0.05);
const at = people.tileOf(0);
const column = world.grid.columnOf(at);
const row = world.grid.rowOf(at);
const fire = world.grid.at(column - 4, row);
console.log('kindled', world.kindle(fire, 300), 'fire', world.isFire(fire));
const egg = world.grid.at(column + 1, row + 2);
console.log('egg added', world.items.add(egg, ItemType.Egg), 'passable', world.passable(egg));
console.log('roaster', people.roasterFor(fire));
sim.apply({ kind: 'roast', tile: fire });
for (let tick = 0; tick < 450; tick += 1) {
  people.hunger.fill(0);
  sim.advance(0.1);
  if (tick % 50 === 0) console.log(`${tick / 10}s`, [0, 1].map((p) => `state ${people.state[p]} task ${people.task[p]} held ${ITEM_NAMES[people.heldItemType[p]!]} fire ${people.roastFire[p]}`).join(' | '));
}
let roast = 0;
for (let slot = 0; slot < world.items.used; slot += 1) if (world.items.kind[slot] === ItemType.Roast) roast += 1;
console.log('roast items', roast, 'states', EntityState.Roasting, Task.Roast);
console.log('finished');
