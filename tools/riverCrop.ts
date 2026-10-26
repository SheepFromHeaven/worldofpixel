import { writeFileSync } from 'node:fs';
import { encodePng } from '../src/pixel/png.ts';
import { BIOME_COLORS } from '../src/render/palette.ts';
import '../src/sim/terrain/windowedInstall.ts';
import { Water } from '../src/sim/terrain/hydrology.ts';
import { buildField, riverTiles } from '../src/sim/terrain/worldfield.ts';

const SEED = Number(process.env.SEED ?? 474236911);
const SPAN = Number(process.env.SPAN ?? 320);
const ZOOM = Number(process.env.ZOOM ?? 3);
const out = process.env.OUT ?? '/tmp/rivercrop.png';
const t0 = performance.now();
const field = buildField(SEED);
const { grid } = field;
console.log(`world ${grid.columns}x${grid.rows} built in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
const banks = riverTiles(field);

const BLOCK = 16;
let land = 0, river = 0, crowded = 0, lakeTiles = 0;
const blocks: { score: number; column: number; row: number }[] = [];
for (let row = 0; row + BLOCK <= grid.rows; row += BLOCK) {
  for (let column = 0; column + BLOCK <= grid.columns; column += BLOCK) {
    let covered = 0;
    let dry = 0;
    for (let dy = 0; dy < BLOCK; dy += 1) for (let dx = 0; dx < BLOCK; dx += 1) {
      const i = (row + dy) * grid.columns + column + dx;
      if (field.water[i] === Water.None) { dry += 1; if (banks[i] === 1) covered += 1; }
    }
    land += dry;
    river += covered;
    if (dry > 0 && covered / BLOCK / BLOCK > 0.3) crowded += covered;
    blocks.push({ score: covered, column, row });
  }
}
for (let i = 0; i < grid.count; i += 1) if (field.water[i] === Water.Lake) lakeTiles += 1;
console.log(`river bank tiles ${(100 * river / land).toFixed(1)}% of dry land, ${(100 * crowded / Math.max(1, river)).toFixed(0)}% of them in 16 tile blocks that are over 30% river, lakes ${(100 * lakeTiles / (land + lakeTiles)).toFixed(2)}% of land, river segments ${field.rivers.segments.length}`);

const around = blocks.sort((a, b) => b.score - a.score)[Number(process.env.PICK ?? 3)]!;
const x0 = Math.max(0, Math.min(grid.columns - SPAN, around.column - SPAN / 2));
const y0 = Math.max(0, Math.min(grid.rows - SPAN, around.row - SPAN / 2));
const width = SPAN * ZOOM;
const pixels = new Uint8Array(width * width * 4);
const rgb = (css: string): [number, number, number] => [parseInt(css.slice(1, 3), 16), parseInt(css.slice(3, 5), 16), parseInt(css.slice(5, 7), 16)];
const palette = BIOME_COLORS.map(rgb);
for (let row = 0; row < SPAN; row += 1) {
  for (let column = 0; column < SPAN; column += 1) {
    const i = (y0 + row) * grid.columns + x0 + column;
    const up = field.height[Math.max(0, i - grid.columns - 1)]!;
    const down = field.height[Math.min(grid.count - 1, i + grid.columns + 1)]!;
    const lit = 1 + Math.max(-0.3, Math.min(0.3, (up - down) * 14));
    let c: [number, number, number];
    if (field.water[i] === Water.Ocean) c = [38, 74, 104];
    else if (field.water[i] === Water.Lake) c = [70, 130, 200];
    else {
      const base = palette[field.biome[i]!] ?? [200, 0, 200];
      c = [Math.min(255, base[0] * lit), Math.min(255, base[1] * lit), Math.min(255, base[2] * lit)];
      if (banks[i] === 1) c = [90, 170, 235];
    }
    for (let dy = 0; dy < ZOOM; dy += 1) for (let dx = 0; dx < ZOOM; dx += 1) pixels.set([c[0], c[1], c[2], 255], ((row * ZOOM + dy) * width + column * ZOOM + dx) * 4);
  }
}
writeFileSync(out, encodePng(pixels, width, width));
console.log(`crop at ${x0},${y0}`);
