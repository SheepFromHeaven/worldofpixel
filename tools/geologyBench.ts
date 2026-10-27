import { Geology } from '../src/sim/geology/geology.ts';
import { baseHeights } from '../src/sim/terrain/heightmap.ts';
import { surfaceBiomes } from '../src/sim/terrain/surface.ts';
import { buildField, riverTiles } from '../src/sim/terrain/worldfield.ts';

const seed = Number(process.env.SEED ?? 20250214);
const REPEAT = Number(process.env.REPEAT ?? 5);
const cpu = (): number => {
  const usage = process.cpuUsage();
  return (usage.user + usage.system) / 1000;
};
const best = (run: () => void): number => {
  let low = Infinity;
  for (let i = 0; i < REPEAT; i += 1) {
    const start = cpu();
    run();
    low = Math.min(low, cpu() - start);
  }
  return low;
};

const field = buildField(seed);
const river = riverTiles(field);
const heights = best(() => void baseHeights(field.grid, seed));
let geology: Geology | null = null;
const rock = best(() => {
  geology = new Geology({ seed, grid: field.grid, field, river });
});
const surface = best(() => void surfaceBiomes(field, geology!, river));
console.log(`${(field.grid.count / 1e6).toFixed(1)}M tiles, best CPU ms of ${REPEAT}: heights ${heights.toFixed(0)}  Geology ${rock.toFixed(0)}  surfaceBiomes ${surface.toFixed(0)}`);
