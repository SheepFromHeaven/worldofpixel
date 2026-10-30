import { buildableIdOf } from '../src/content/buildables.ts';
import { CORE_MODULES } from '../src/modules/index.ts';
import { Simulation } from '../src/sim/simulation.ts';
import { ItemType } from '../src/modules/items/api.ts';
import { World } from '../src/sim/world.ts';
import { worldDigest } from './worldDigest.ts';

const sim = new Simulation(7, 'settle', null, null, CORE_MODULES);
const { world, people } = sim;
const here = people.tileOf(0);
const near = (dx: number, dy: number): number => world.grid.at(world.grid.columnOf(here) + dx, world.grid.rowOf(here) + dy);

const mirror = World.mirror(world.seed, world.ground());
mirror.apply(world.introduce());

const compare = (label: string): boolean => {
  const a = worldDigest(world);
  const b = worldDigest(mirror);
  const wrong = Object.keys(a).filter((key) => a[key] !== b[key]);
  console.log(label, wrong.length === 0 ? 'in sync' : `DIFFERENT ${wrong.join(', ')}`);
  return wrong.length === 0;
};

let ok = compare('after introduce');
for (const [kind, at, station] of [['blueprint', near(3, 0), 'storage'], ['blueprint', near(4, 0), 'knappingFloor'], ['blueprint', near(5, 1), 'bed'], ['blueprint', near(6, 1), 'wall'], ['planCampfire', near(3, 2)]] as const) sim.apply({ kind, tile: at, station });
for (let i = 0; i < 4; i += 1) world.items.add(near(2 + i, -2), ItemType.Branch);
world.structures.kindle(near(-3, 0));
world.structures.plant(near(-4, 0));
world.structures.raise(near(-6, 1), buildableIdOf('floor'));
world.structures.raise(near(-7, 1), buildableIdOf('wall'));
world.trails.tread(near(0, 3), 40);
world.fell(near(0, 1));
for (let step = 0; step < 300; step += 1) sim.advance(0.1);
mirror.apply(world.drain());
ok = compare('after changes') && ok;
for (let step = 0; step < 600; step += 1) sim.advance(0.1);
mirror.apply(world.drain());
ok = compare('after more steps') && ok;
console.log(Object.entries(worldDigest(world)).map(([key, value]) => `${key} ${value}`).join(' | '));
process.exit(ok ? 0 : 1);
