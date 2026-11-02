import { stationIdOf, stationOf } from '../src/content/stations/index.ts';
import { CORE_MODULES } from '../src/modules/index.ts';
import { itemId, ItemType } from '../src/modules/items/api.ts';
import { Simulation } from '../src/sim/simulation.ts';
import { NOWHERE } from '../src/sim/grid.ts';

const sim = new Simulation(7, 'settle', null, null, CORE_MODULES);
const { world, people } = sim;
const { structures } = world;
const bed = stationOf(stationIdOf('bed'))!;
const here = people.tileOf(0);
const at = (dx: number, dy: number): number => world.grid.at(world.grid.columnOf(here) + dx, world.grid.rowOf(here) + dy);
const clear = (tile: number): boolean => tile !== NOWHERE && world.movement.passable(tile) && world.tile(tile).cover === 0;

let site = NOWHERE;
for (let reach = 3; reach < 60 && site === NOWHERE; reach += 1) {
  const cells = [0, 1, 2, 3].flatMap((turn) => structures.cellsOf(bed, at(reach, 0), turn));
  if (cells.every(clear)) site = at(reach, 0);
}
const shape = (turn: number): string => structures.cellsOf(bed, site, turn).map((tile) => `${world.grid.columnOf(tile) - world.grid.columnOf(site)},${world.grid.rowOf(tile) - world.grid.rowOf(site)}`).join(' ');
for (let turn = 0; turn < 4; turn += 1) console.log('turn', turn, shape(turn), 'fits', structures.fits(bed, site, turn));

sim.apply({ kind: 'blueprint', tile: site, station: 'bed', turn: 1 });
const [first, second] = structures.cellsOf(bed, site, 1);
console.log('planned both tiles', structures.isPlanned(first!), structures.isPlanned(second!), 'plans', structures.plans.length, 'anchor of far tile', structures.anchorOf(second!) === site);
console.log('conflict on the same spot', structures.fit(bed, site, 0).map((cell) => cell.reason).join(' | '));
console.log('overlapping second placement refused', sim.apply({ kind: 'blueprint', tile: second!, station: 'bed', turn: 0 }) === undefined, 'plans', structures.plans.length);

sim.apply({ kind: 'cancelPlan', tile: second! });
console.log('cancelled from the far tile', structures.plans.length, structures.isPlanned(first!), structures.isPlanned(second!), 'part', structures.part[second!], 'turn', structures.turn[second!]);

const spare = (dx: number, dy: number): number => {
  let tile = at(dx, dy);
  for (let step = 0; step < 20 && !world.movement.passable(tile); step += 1) tile = at(dx + step, dy);
  return tile;
};
for (let i = 0; i < 2; i += 1) world.items.add(spare(1 + i, -3), ItemType.Branch);
for (let i = 0; i < 3; i += 1) world.items.add(spare(1 + i, -4), itemId('plantFibre') as ItemType);
sim.apply({ kind: 'blueprint', tile: site, station: 'bed', turn: 3 });
for (let tick = 0; tick < 9000 && structures.built[site] === 0; tick += 1) {
  people.hunger.fill(0);
  people.thirst.fill(0);
  sim.advance(0.1);
}
const cells = structures.cellsOf(bed, site, 3);
console.log('built', cells.map((tile) => stationOf(structures.built[tile]!)?.name).join(' + '), 'turn', structures.turn[site], 'parts', cells.map((tile) => structures.part[tile]).join(','), 'stations', structures.stations.length, 'plans left', structures.plans.length);
console.log('fits over it', structures.fits(bed, cells[1]!, 0), structures.fit(bed, cells[1]!, 0).map((cell) => cell.reason).join(' | '));

const saved = sim.snapshot();
const again = new Simulation(7, 'settle', saved, null, CORE_MODULES);
const back = again.world.structures;
console.log('round trip', back.stations.length, cells.map((tile) => `${back.built[tile]}/${back.turn[tile]}/${back.part[tile]}`).join(' '));

sim.apply({ kind: 'demolish', tile: cells[1]! });
console.log('taken down from the far tile', cells.map((tile) => structures.built[tile]).join(','), 'stations', structures.stations.length, 'part', cells.map((tile) => structures.part[tile]).join(','));
