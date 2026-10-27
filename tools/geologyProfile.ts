import { Geology } from '../src/sim/geology/geology.ts';
import { surfaceBiomes } from '../src/sim/terrain/surface.ts';
import { buildField, riverTiles } from '../src/sim/terrain/worldfield.ts';

const seed = Number(process.env.SEED ?? 20250214);
const field = buildField(seed);
const river = riverTiles(field);
const REPEAT = Number(process.env.REPEAT ?? 1);
for (let i = 0; i < REPEAT; i += 1) {
  let t = performance.now();
  const geology = new Geology({ seed, grid: field.grid, field, river });
  const built = performance.now() - t;
  t = performance.now();
  surfaceBiomes(field, geology, river);
  const surface = performance.now() - t;
  console.log(`${(field.grid.count / 1e6).toFixed(1)}M tiles: Geology ${built.toFixed(0)} ms, surfaceBiomes ${surface.toFixed(0)} ms, riverTiles+rest not timed`);
}
