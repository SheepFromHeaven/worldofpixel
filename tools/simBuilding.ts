import { buildingIdOf, buildingOf } from '../src/content/buildings/index.ts';
import { CORE_MODULES } from '../src/sim/modules/index.ts';
import { itemId, ItemType } from '../src/sim/people/items.ts';
import { Simulation } from '../src/sim/simulation.ts';
import { slicesFor } from '../src/ui/radialSlices.ts';

const sim = new Simulation(7, 'settle', null, null, CORE_MODULES);
const { world, people } = sim;
const here = people.tileOf(0);
const near = (dx: number, dy: number): number => world.grid.at(world.grid.columnOf(here) + dx, world.grid.rowOf(here) + dy);
let reach = 3;
while (reach < 40 && (!world.movement.passable(near(reach, 0)) || world.tile(near(reach, 0)).cover !== 0)) reach += 1;
const site = near(reach, 0);

const context = { world, people, mode: sim.mode, depth: 0, plane: 0, knows: (id: string) => id === 'hut', deepCaveAt: () => false, igniterNear: () => false };
const labels = slicesFor(context, { send: () => undefined, inspect: () => undefined }, site).flatMap((slice) => slice.children?.map((child) => child.label) ?? [slice.label]);
console.log('offered:', labels.filter((label) => ['Bed', 'Hut', 'Snare', 'Tipi'].includes(label)).join(', '));

const spare = (dx: number, dy: number): number => {
  let tile = near(dx, dy);
  for (let step = 0; step < 20 && !world.movement.passable(tile); step += 1) tile = near(dx + step, dy);
  return tile;
};
const lay = (kind: number, count: number, row: number): void => { for (let i = 0; i < count; i += 1) world.items.add(spare(2 + i, row), kind as ItemType); };
lay(itemId('hide'), 4, 2);
lay(ItemType.Branch, 6, 3);
lay(ItemType.Cord, 2, 4);

sim.apply({ kind: 'build', tile: site, building: 'tipi' });
console.log('planned', world.structures.isPlanned(site), 'needs', buildingOf(buildingIdOf('tipi'))!.needs.map(([key, n]) => `${n} ${key}`).join(', '));
for (let tick = 0; tick < 9000 && world.structures.built[site] === 0; tick += 1) {
  people.hunger.fill(0);
  people.thirst.fill(0);
  sim.advance(0.1);
}
const id = world.structures.built[site]!;
console.log('built', buildingOf(id)?.name, 'solid so passable =', world.movement.passable(site), 'plans left', world.structures.plans.length);
const side = people.shelterAt(near(reach + 1, 0)) ;
console.log('sheltered beside it:', buildingOf(side)?.name ?? 'no');
