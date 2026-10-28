import { behaviourOf, MIGRATED } from '../src/animals/catalogue.ts';
import { statesOf } from '../src/animals/types.ts';
import { Animals } from '../src/sim/animals/animals.ts';
import { abilityOf } from '../src/sim/climb/ability.ts';
import { DEFAULT_TUNING, Fauna } from '../src/sim/fauna/fauna.ts';
import { PATCH_TILES } from '../src/sim/fauna/life.ts';
import { MAMMALS } from '../src/sim/mammals/species.ts';
import { World } from '../src/sim/world.ts';

const SEED = Number(process.env.SEED ?? 20250214);
const SPOTS = Number(process.env.SPOTS ?? 30);
const SECONDS = Number(process.env.SECONDS ?? 400);

for (const key of (process.env.ALSO ?? '').split(',').filter(Boolean)) (MIGRATED as Set<string>).add(key);

const world = World.generate(SEED);
const fauna = new Fauna(world, SEED, { ...DEFAULT_TUNING, maxStep: 0.25 });
const { columns, count } = fauna.patches;
const { grid } = world;
const celsius = new Float32Array(count);
for (let p = 0; p < count; p += 1) {
  const column = Math.min(grid.columns - 1, (p % columns) * PATCH_TILES + 8);
  const row = Math.min(grid.rows - 1, Math.floor(p / columns) * PATCH_TILES + 8);
  celsius[p] = world.field.temperature[row * grid.columns + column]!;
}
const weather = { celsius, snow: new Float32Array(count), cellOf: Int32Array.from({ length: count }, (_, i) => i) };
fauna.populate();
for (let i = 0; i < 6; i += 1) fauna.sweep(0.25, weather);

const spots: { x: number; y: number; trees: number }[] = [];
for (let row = 30; row < grid.rows - 30; row += 20) {
  for (let column = 30; column < grid.columns - 30; column += 20) {
    let trees = 0;
    for (let dy = -8; dy <= 8; dy += 2) for (let dx = -8; dx <= 8; dx += 2) if (world.plants.canopy[grid.at(column + dx, row + dy)] !== 0) trees += 1;
    if (trees >= 20) spots.push({ x: grid.minX + (column + 0.5) * grid.spacing, y: grid.minY + (row + 0.5) * grid.spacing, trees });
  }
}
spots.sort((a, b) => b.trees - a.trees);

const stats = new Map<string, { groups: number; climbs: number; samples: number; aloft: number; top: number; leaps: number; climbing: number }>();
for (const spot of spots.slice(0, SPOTS)) {
  const animals = new Animals(world, fauna, SEED, { busyAt: () => 1, comfortAt: () => 1 });
  animals.setFocus({ x: spot.x, y: spot.y, radius: 120 });
  const wasUp = new Map<number, boolean>();
  for (let time = 0; time < SECONDS; time += 0.5) {
    animals.update(0.5, 0.5);
    const { store } = animals;
    for (let slot = 0; slot < store.n; slot += 1) {
      const id = store.species[slot]!;
      if (id >= MAMMALS.length) continue;
      const kind = MAMMALS[id]!;
      if (!abilityOf(kind.key)) continue;
      const row = stats.get(kind.key) ?? { groups: 0, climbs: 0, samples: 0, aloft: 0, top: 0, leaps: 0, climbing: 0 };
      stats.set(kind.key, row);
      row.samples += 1;
      const z = store.posZ[slot]!;
      const key = id * 4096 + slot;
      const up = z > 0.05;
      if (up) {
        row.aloft += 1;
        row.top = Math.max(row.top, z);
        const states = statesOf(behaviourOf(kind.key));
        const name = states[store.state[slot]!];
        if (name === 'leap') row.leaps += 1;
        if (name === 'climb') row.climbing += 1;
        if (!wasUp.get(key) && store.member[slot] === 0) row.climbs += 1;
      }
      wasUp.set(key, up);
    }
  }
}
for (const [key, row] of stats) console.log(`${key.padEnd(12)} samples ${row.samples}  aloft ${((100 * row.aloft) / Math.max(1, row.samples)).toFixed(1)}%  climbs ${row.climbs}  highest ${row.top.toFixed(1)} m  climbing ${row.climbing}  leaping ${row.leaps}`);
if (stats.size === 0) console.log('no climbers in these stands');
