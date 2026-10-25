import { writeFileSync } from 'node:fs';
import { encodePng } from '../src/pixel/png.ts';
import { World } from '../src/sim/world.ts';

const world = World.generate(Number(process.argv[2] ?? 20250214));
const out = process.argv[3] ?? '/tmp/eco.png';
const STEP = 4;
const { grid } = world;
const columns = Math.floor(grid.columns / STEP);
const rows = Math.floor(grid.rows / STEP);
const pixels = new Uint8Array(columns * 2 * rows * 4);
const histogram = new Array<number>(8).fill(0);

for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const i = grid.at(column * STEP, row * STEP);
    const eco = world.eco[i]!;
    const wet = world.biome[i]! >= 6 || world.river[i] === 1;
    const t = eco / 255;
    const green: [number, number, number] = wet ? [40, 66, 102] : [
      Math.round(158 + (40 - 158) * Math.sqrt(t)),
      Math.round(140 + (128 - 140) * Math.sqrt(t)),
      Math.round(107 + (51 - 107) * Math.sqrt(t)),
    ];
    pixels.set([...green, 255], (row * columns * 2 + column) * 4);
    const hues: readonly (readonly [number, number, number])[] = [
      [120, 190, 90], [40, 110, 50], [150, 140, 130], [90, 130, 120], [210, 220, 230], [220, 190, 110], [40, 66, 102], [70, 120, 190], [70, 120, 190],
    ];
    pixels.set([...hues[world.biome[i]!]!, 255], (row * columns * 2 + columns + column) * 4);
    if (!wet) histogram[Math.min(7, eco >> 5)] = histogram[Math.min(7, eco >> 5)]! + 1;
  }
}

writeFileSync(out, encodePng(pixels, columns * 2, rows));
const land = histogram.reduce((a, b) => a + b, 0);
console.log(histogram.map((n, k) => `${k * 32}+: ${((100 * n) / land).toFixed(1)}%`).join('  '));
