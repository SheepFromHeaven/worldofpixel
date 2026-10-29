import { Simulation } from '../src/sim/simulation.ts';
import { ItemType } from '../src/sim/people/items.ts';
import { Building } from '../src/sim/world.ts';

const sim = new Simulation(20250214, 'settle', null);
const { world, people } = sim;
sim.advance(0.05);
const at = people.tileOf(0);
const column = world.grid.columnOf(at);
const row = world.grid.rowOf(at);
const near = (dx: number, dy: number) => world.grid.at(column + dx, row + dy);
const stock: readonly (readonly [ItemType, number])[] = [
  [ItemType.Branch, 9],
  [ItemType.PlantFibre, 9],
  [ItemType.Cord, 1],
];
let spot = 0;
for (const [kind, count] of stock) for (let i = 0; i < count; i += 1) world.items.add(near(2 + (spot % 6), 2 + Math.floor(spot++ / 6)), kind);
const bed = near(-3, 2);
const hut = near(-6, 2);
console.log('plan bed', world.planBuilding(bed, 2 === 2 ? 4 : 4), 'plan hut', world.planBuilding(hut, 5));
for (let tick = 0; tick < 6000; tick += 1) {
  people.hunger.fill(0);
  people.thirst.fill(0);
  sim.advance(0.1);
  if (tick % 1000 === 999) console.log(`${(tick + 1) / 10}s bed ${world.built[bed]} hut ${world.built[hut]} plans ${world.plans.length} states ${[...people.state.slice(0, people.count)].join(',')}`);
}
console.log('built', world.buildings.length, 'hut passable', world.passable(hut), 'bed passable', world.passable(bed), Building.Hut);
people.tiredness.fill(0.9);
people.bodyTemp.fill(36);
for (let tick = 0; tick < 600; tick += 1) {
  people.hunger.fill(0);
  people.thirst.fill(0);
  sim.advance(0.1);
  if (tick % 100 === 99) console.log(`${(tick + 1) / 10}s tired ${[...people.tiredness.slice(0, people.count)].map((value) => value.toFixed(2)).join(',')} lying ${[0, 1].map((p) => people.isLying(p)).join(',')} shelter ${[0, 1].map((p) => people.shelterAt(people.tileOf(p))).join(',')}`);
}
console.log('finished');
