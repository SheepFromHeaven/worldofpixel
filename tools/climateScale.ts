import { TileGrid } from '../src/sim/grid.ts';
import { latitudesOf, precipitation, temperatures } from '../src/sim/terrain/climate.ts';
import { baseHeights } from '../src/sim/terrain/heightmap.ts';

const SEED = Number(process.env.SEED ?? 20250214);
const SPACINGS = (process.env.SPACINGS ?? '8,16,32,64,128,256').split(',').map(Number);
const latitudes = latitudesOf(SEED);

const rainAt = (spacing: number): { grid: TileGrid; rain: Float32Array } => {
  const grid = TileGrid.world(spacing);
  const height = baseHeights(grid, SEED);
  return { grid, rain: precipitation(grid, height, temperatures(grid, height, latitudes), latitudes, SEED) };
};

const fine = rainAt(1);
console.log(`${fine.grid.columns}x${fine.grid.rows} tiles; rain per tile computed at spacing 1, then pooled over each coarse cell`);

for (const spacing of SPACINGS) {
  const coarse = rainAt(spacing);
  let n = 0, within = 0, sumLog = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let row = 0; row < coarse.grid.rows; row += 1) {
    for (let column = 0; column < coarse.grid.columns; column += 1) {
      let sum = 0;
      let m = 0;
      for (let dy = 0; dy < spacing && row * spacing + dy < fine.grid.rows; dy += 1) for (let dx = 0; dx < spacing && column * spacing + dx < fine.grid.columns; dx += 1) {
        sum += fine.rain[(row * spacing + dy) * fine.grid.columns + column * spacing + dx]!;
        m += 1;
      }
      const truth = sum / m;
      const got = coarse.rain[row * coarse.grid.columns + column]!;
      if (truth <= 0 && got <= 0) continue;
      n += 1;
      sumLog += Math.abs(Math.log2((got + 1) / (truth + 1)));
      if (got + 1 < 2 * (truth + 1) && truth + 1 < 2 * (got + 1)) within += 1;
      sx += truth; sy += got; sxx += truth * truth; syy += got * got; sxy += truth * got;
    }
  }
  const corr = (n * sxy - sx * sy) / Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  console.log(`spacing ${String(spacing).padStart(3)}: ${String(n).padStart(8)} cells, correlation ${corr.toFixed(3)}, within 2x ${((100 * within) / n).toFixed(0)}%, mean |log2 error| ${(sumLog / n).toFixed(2)}, mean rain ${(sy / n).toFixed(2)} vs ${(sx / n).toFixed(2)}`);
}
