import { buildableIdOf } from '../src/content/buildables.ts';
import { CORE_MODULES } from '../src/modules/index.ts';
import { Simulation } from '../src/sim/simulation.ts';

const first = new Simulation(7, 'settle', null, null, CORE_MODULES);
first.people.hunger.fill(0.3);
{
  const { world, people } = first;
  const at = people.tileOf(0);
  const near = (dx: number, dy: number): number => world.grid.at(world.grid.columnOf(at) + dx, world.grid.rowOf(at) + dy);
  for (const [kind, tile, station] of [['blueprint', near(3, 0), 'storage'], ['blueprint', near(4, 0), 'knappingFloor'], ['blueprint', near(5, 1), 'bed'], ['blueprint', near(6, 1), 'wall'], ['planCampfire', near(3, 2)]] as const) first.apply({ kind, tile, station });
  world.structures.kindle(near(-3, 0));
  world.structures.plant(near(-4, 0));
  world.structures.plant(near(-5, 0), 12);
  world.structures.raise(near(-6, 1), 1);
  world.structures.raise(near(-7, 1), buildableIdOf('floor'));
  world.structures.raise(near(-8, 1), buildableIdOf('wall'));
  world.trails.tread(near(0, 3), 40);
  world.items.add(near(2, 3), 1);
  world.items.add(near(2, 3), 1);
  console.log('structures', world.structures.storageTiles.length, world.structures.floors.length, world.structures.plans.length, world.structures.fires.length, world.structures.torches.length, world.structures.stations.length);
}
for (let step = 0; step < 200; step += 1) first.advance(0.1);
const saved = first.snapshot();
const second = new Simulation(7, 'settle', saved, null, CORE_MODULES);
const again = second.snapshot();
for (const key of Object.keys(saved)) {
  const a = JSON.stringify((saved as never)[key]);
  const b = JSON.stringify((again as never)[key]);
  if (a !== b && key === 'world') for (const field of Object.keys((saved as never)[key])) { const x = JSON.stringify((saved as never)[key][field]); const y = JSON.stringify((again as never)[key][field]); if (x !== y) console.log('  world.' + field, x.slice(0, 200), '|', y.slice(0, 200)); }
  if (a !== b) console.log('differs:', key, a.length, b.length, a.slice(0, 120), '|', b.slice(0, 120));
}
const same = JSON.stringify(saved) === JSON.stringify(again);
console.log('keys', Object.keys(saved).join(','), 'round trip', same ? 'identical' : 'DIFFERENT');
process.exit(same ? 0 : 1);
