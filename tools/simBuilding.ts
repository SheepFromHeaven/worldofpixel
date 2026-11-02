import { buildableIdOf, buildableOf } from '../src/content/buildables.ts';
import { CORE_MODULES } from '../src/modules/index.ts';
import { ItemType } from '../src/modules/items/api.ts';
import { Simulation } from '../src/sim/simulation.ts';
import { slicesFor } from '../src/ui/radialSlices.ts';

const sim = new Simulation(7, 'settle', null, null, CORE_MODULES);
const { world, people } = sim;
const here = people.tileOf(0);
const near = (dx: number, dy: number): number => world.grid.at(world.grid.columnOf(here) + dx, world.grid.rowOf(here) + dy);
let reach = 3;
while (reach < 40 && (!world.movement.passable(near(reach, 0)) || world.tile(near(reach, 0)).cover !== 0)) reach += 1;
const site = near(reach, 0);

const known = new Set(['frame', 'shelter']);
const context = { world, people, mode: sim.mode, depth: 0, plane: 0, knows: (id: string) => known.has(id), deepCaveAt: () => false, igniterNear: () => false };
const labels = slicesFor(context, { send: () => undefined, inspect: () => undefined }, site).flatMap((slice) => slice.children?.map((child) => child.label) ?? [slice.label]);
console.log('offered:', labels.filter((label) => ['Floor', 'Wall', 'Bed'].includes(label)).join(', '));

const spare = (dx: number, dy: number): number => {
  let tile = near(dx, dy);
  for (let step = 0; step < 20 && !world.movement.passable(tile); step += 1) tile = near(dx + step, dy);
  return tile;
};
const lay = (kind: number, count: number, row: number): void => { for (let i = 0; i < count; i += 1) world.items.add(spare(2 + i, row), kind as ItemType); };
lay(ItemType.Branch, 7, 2);
lay(ItemType.Cord, 1, 3);

const { structures } = world;
const floor = buildableIdOf('floor');
const wall = buildableIdOf('wall');
sim.apply({ kind: 'blueprint', tile: site, station: 'floor' });
sim.apply({ kind: 'blueprint', tile: near(reach, 1), station: 'wall' });
console.log('planned floor', structures.isPlanned(site), 'wall', structures.isPlanned(near(reach, 1)), 'needs', buildableOf(wall)!.needs.map(([key, n]) => `${n} ${key}`).join(', '));
for (let tick = 0; tick < 12000 && (structures.block[site] === 0 || structures.block[near(reach, 1)] === 0); tick += 1) {
  people.hunger.fill(0);
  people.thirst.fill(0);
  sim.advance(0.1);
}
console.log('built', buildableOf(structures.block[site]!)?.name, 'and', buildableOf(structures.block[near(reach, 1)]!)?.name, 'plans left', structures.plans.length, 'blocks', structures.blocks.length);
console.log('floor passable', world.movement.passable(site), 'wall passable', world.movement.passable(near(reach, 1)));
console.log('conflict on the wall', structures.fit(buildableOf(wall)!, near(reach, 1), 0).map((cell) => cell.reason).join(' | '), '| station on the wall', structures.fit(buildableOf(buildableIdOf('bed'))!, near(reach, 1), 0).map((cell) => cell.reason).join(' | '));
console.log('station on the floor', structures.fit(buildableOf(buildableIdOf('storage'))!, site, 0).map((cell) => cell.reason ?? 'fits').join(' | '));
sim.apply({ kind: 'demolish', tile: near(reach, 1) });
console.log('wall taken down', structures.block[near(reach, 1)], 'blocks', structures.blocks.length, 'passable again', world.movement.passable(near(reach, 1)), floor);
