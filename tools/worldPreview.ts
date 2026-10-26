import { writeFileSync } from 'node:fs';
import { encodePng } from '../src/pixel/png.ts';
import { BIOME_COLORS } from '../src/render/palette.ts';
import { classify } from '../src/sim/terrain/climate.ts';
import { buildCoarse } from '../src/sim/terrain/coarse.ts';
import { Water } from '../src/sim/terrain/hydrology.ts';

const SEED = Number(process.env.SEED ?? 20250214);
const K = Number(process.env.K ?? 8);
const ZOOM = Number(process.env.ZOOM ?? 1);
const out = process.env.OUT ?? '/tmp/world.png';
const coarse = buildCoarse(SEED, K);
const { grid } = coarse;
const width = grid.columns * ZOOM;
const height = grid.rows * ZOOM;
const pixels = new Uint8Array(width * height * 4);
const rgb = (css: string): [number, number, number] => [parseInt(css.slice(1, 3), 16), parseInt(css.slice(3, 5), 16), parseInt(css.slice(5, 7), 16)];
const palette = BIOME_COLORS.map(rgb);

for (let row = 0; row < grid.rows; row += 1) {
  for (let column = 0; column < grid.columns; column += 1) {
    const i = row * grid.columns + column;
    const up = coarse.height[Math.max(0, row - 1) * grid.columns + Math.max(0, column - 1)]!;
    const down = coarse.height[Math.min(grid.rows - 1, row + 1) * grid.columns + Math.min(grid.columns - 1, column + 1)]!;
    const lit = 1 + Math.max(-0.3, Math.min(0.3, (up - down) * 6));
    let colour: [number, number, number];
    if (coarse.flow.water[i] === Water.Ocean) colour = [38, 74, 104];
    else if (coarse.flow.water[i] === Water.Lake) colour = [70, 130, 200];
    else {
      const base = palette[classify(coarse.height[i]!, coarse.temperature[i]!, coarse.wet[i]!, coarse.rivers.of[i] !== 0)] ?? [255, 0, 255];
      colour = [Math.min(255, base[0] * lit), Math.min(255, base[1] * lit), Math.min(255, base[2] * lit)];
    }
    for (let dy = 0; dy < ZOOM; dy += 1) for (let dx = 0; dx < ZOOM; dx += 1) pixels.set([colour[0], colour[1], colour[2], 255], ((row * ZOOM + dy) * width + column * ZOOM + dx) * 4);
  }
}
writeFileSync(out, encodePng(pixels, width, height));
console.log(`${grid.columns}x${grid.rows} cells of ${K} tiles, ${grid.columns * K}x${grid.rows * K} tiles`);
