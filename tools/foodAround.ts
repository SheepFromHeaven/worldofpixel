import { Cover } from '../src/sim/covers.ts';
import { openingSpot } from '../src/sim/simulation.ts';
import { World } from '../src/sim/world.ts';

for (const seed of [20250214, 7, 42]) {
  const world = World.generate(seed);
  world.plants.phase = 0.4;
  const at = world.grid.atPoint(openingSpot(world));
  const column = world.grid.columnOf(at);
  const row = world.grid.rowOf(at);
  let fruit = 0;
  let best = 0;
  let trees = 0;
  const damps: number[] = [];
  let bushes = 0;
  for (let dy = -34; dy <= 34; dy += 1) {
    for (let dx = -34; dx <= 34; dx += 1) {
      const tile = world.grid.at(column + dx, row + dy);
      if (tile < 0) continue;
      const kcal = Math.max(world.plants.fruitKcal(tile, 'canopy'), world.plants.fruitKcal(tile, 'under'));
      if (kcal >= 80) fruit += 1;
      best = Math.max(best, kcal);
      const cover = world.coverOf(tile);
      if (cover === Cover.Tree || cover === Cover.Fallen) {
        trees += 1;
        damps.push(world.damp[tile]!);
      }
      if (cover === Cover.Bush || cover === Cover.Scrub) bushes += 1;
    }
  }
  damps.sort((a, b) => a - b);
  console.log(`seed ${seed}: fruit tiles ${fruit} (best ${best.toFixed(0)} kcal), trees ${trees}, damp median ${damps[Math.floor(damps.length / 2)] ?? '-'} max ${damps[damps.length - 1] ?? '-'}, bushes ${bushes}`);
}
