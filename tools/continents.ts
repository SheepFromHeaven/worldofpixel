import { writeFileSync } from 'node:fs';
import { encodePng } from '../src/pixel/png.ts';
import { TileGrid } from '../src/sim/grid.ts';
import { baseHeights, SEA_LEVEL } from '../src/sim/terrain/heightmap.ts';

const SEEDS = (process.env.SEEDS ?? '1,2,3,4,5,6').split(',').map(Number);
const SPACING = Number(process.env.K ?? 8);
const ACROSS = Number(process.env.ACROSS ?? 3);
const out = process.env.OUT ?? '/tmp/continents.png';
const grid = TileGrid.world(SPACING);
const gap = 4;
const rowsOfMaps = Math.ceil(SEEDS.length / ACROSS);
const width = ACROSS * (grid.columns + gap);
const height = rowsOfMaps * (grid.rows + gap);
const pixels = new Uint8Array(width * height * 4).fill(255);
let landShare = '';
SEEDS.forEach((seed, index) => {
  const heights = baseHeights(grid, seed);
  const ox = (index % ACROSS) * (grid.columns + gap);
  const oy = Math.floor(index / ACROSS) * (grid.rows + gap);
  let land = 0;
  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const h = heights[row * grid.columns + column]!;
      let c: [number, number, number];
      if (h < SEA_LEVEL) { const d = Math.max(0, 1 - (SEA_LEVEL - h) * 3); c = [30 + 40 * d, 70 + 60 * d, 110 + 70 * d]; }
      else { land += 1; const a = Math.min(1, (h - SEA_LEVEL) * 2.5); c = [70 + 150 * a, 140 + 60 * a - 60 * a * a, 60 + 150 * a]; }
      pixels.set([c[0], c[1], c[2], 255], ((oy + row) * width + ox + column) * 4);
    }
  }
  landShare += `${seed}: ${(100 * land / grid.count).toFixed(0)}%  `;
});
writeFileSync(out, encodePng(pixels, width, height));
console.log(landShare);
