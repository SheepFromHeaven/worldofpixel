import { writeFileSync } from 'node:fs';
import { encodePng } from '../src/pixel/png.ts';
import { buildCoarse } from '../src/sim/terrain/coarse.ts';
import { SEA_LEVEL } from '../src/sim/terrain/heightmap.ts';
import { Water } from '../src/sim/terrain/hydrology.ts';
import { buildNetwork } from '../src/sim/terrain/riverNetwork.ts';

const SEED = Number(process.env.SEED ?? 20250214);
const K = Number(process.env.K ?? 8);
const out = process.env.OUT ?? '/tmp/world.png';
const coarse = buildCoarse(SEED, K);
const network = buildNetwork(coarse);
const { grid } = coarse;
const pixels = new Uint8Array(grid.count * 4);
for (let row = 0; row < grid.rows; row += 1) {
  for (let column = 0; column < grid.columns; column += 1) {
    const i = row * grid.columns + column;
    const h = coarse.height[i]!;
    const up = coarse.height[Math.max(0, row - 1) * grid.columns + Math.max(0, column - 1)]!;
    const down = coarse.height[Math.min(grid.rows - 1, row + 1) * grid.columns + Math.min(grid.columns - 1, column + 1)]!;
    const lit = 1 + Math.max(-0.3, Math.min(0.3, (up - down) * 6));
    let colour: [number, number, number];
    if (coarse.flow.water[i] === Water.Ocean) {
      const depth = Math.min(1, (SEA_LEVEL - h) * 3);
      colour = [20 + 10 * (1 - depth), 50 + 30 * (1 - depth), 100 + 40 * (1 - depth)];
    } else if (coarse.flow.water[i] === Water.Lake) colour = [70, 120, 190];
    else {
      const t = Math.min(1, Math.max(0, (h - SEA_LEVEL) / (1 - SEA_LEVEL)));
      colour = t < 0.15 ? [110, 150, 80] : t < 0.4 ? [150, 160, 90] : t < 0.65 ? [160, 140, 100] : [210, 210, 210];
      colour = [colour[0] * lit, colour[1] * lit, colour[2] * lit];
    }
    pixels.set([colour[0], colour[1], colour[2], 255], i * 4);
  }
}
for (let s = 0; s < network.count; s += 1) {
  const c = Math.floor((network.x[s]! - grid.minX) / K);
  const r = Math.floor((network.y[s]! - grid.minY) / K);
  if (c < 0 || r < 0 || c >= grid.columns || r >= grid.rows) continue;
  pixels.set([90, 170, 240, 255], (r * grid.columns + c) * 4);
}
writeFileSync(out, encodePng(pixels, grid.columns, grid.rows));
console.log(`${grid.columns}x${grid.rows} cells, ${coarse.grid.columns * K}x${coarse.grid.rows * K} tiles`);
