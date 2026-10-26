import { writeFileSync } from 'node:fs';
import { encodePng } from '../src/pixel/png.ts';
import { TileGrid } from '../src/sim/grid.ts';
import { buildCoarse } from '../src/sim/terrain/coarse.ts';
import { Water } from '../src/sim/terrain/hydrology.ts';
import { buildWindow, windowIndex } from '../src/sim/terrain/window.ts';
import { Biome } from '../src/sim/types.ts';
import { truthFrom } from './windowTruth.ts';

const SEED = Number(process.env.SEED ?? 20250214);
const SIZE = Number(process.env.SIZE ?? 256);
const ACROSS = Number(process.env.ACROSS ?? 3);
const HALO = Number(process.env.HALO ?? 32);
const out = process.env.OUT ?? '/tmp/lakes.png';

const coarse = buildCoarse(SEED, 8);
const truth = truthFrom(coarse, null, SEED);
const fine = TileGrid.world(1);
const span = SIZE * ACROSS;

let best: [number, number] = [96, 96];
let bestScore = -1;
if (process.env.X0 && process.env.Y0) best = [Number(process.env.X0), Number(process.env.Y0)];
else {
  for (let row = 96; row + span <= fine.rows - 96; row += SIZE) {
    for (let column = 96; column + span <= fine.columns - 96; column += SIZE) {
      let lakes = 0;
      for (let r = row; r < row + span; r += 4) for (let c = column; c < column + span; c += 4) if (truth.water[r * fine.columns + c] === Water.Lake) lakes += 1;
      if (lakes > bestScore) {
        bestScore = lakes;
        best = [column, row];
      }
    }
  }
}
const [x0, y0] = best;
console.log(`region ${x0},${y0}, ${span} tiles square`);

const biome = new Uint8Array(span * span);
const water = new Uint8Array(span * span);
const height = new Float32Array(span * span);
for (let wy = 0; wy < ACROSS; wy += 1) {
  for (let wx = 0; wx < ACROSS; wx += 1) {
    const win = buildWindow(coarse, null, x0 + wx * SIZE, y0 + wy * SIZE, SIZE, SIZE, { halo: HALO });
    for (let row = 0; row < SIZE; row += 1) {
      for (let column = 0; column < SIZE; column += 1) {
        const i = windowIndex(win, x0 + wx * SIZE + column, y0 + wy * SIZE + row);
        const at = (wy * SIZE + row) * span + wx * SIZE + column;
        biome[at] = win.biome[i]!;
        water[at] = win.water[i]!;
        height[at] = win.terrain[i]!;
      }
    }
  }
}

const colour = (b: number, w: number, shade: number): [number, number, number] => {
  if (w === Water.Ocean) return [30, 60, 110];
  if (w === Water.Lake) return [70, 130, 200];
  const land: Record<number, [number, number, number]> = { [Biome.Meadow]: [128, 168, 84], [Biome.Forest]: [58, 110, 62], [Biome.Highland]: [150, 140, 126], [Biome.Marsh]: [96, 130, 104], [Biome.Tundra]: [196, 204, 200], [Biome.Desert]: [214, 188, 124] };
  const base = land[b] ?? [170, 150, 130];
  return [Math.min(255, base[0] * shade), Math.min(255, base[1] * shade), Math.min(255, base[2] * shade)];
};

const panels = ['truth', 'windows'] as const;
const width = span * panels.length + 8;
const pixels = new Uint8Array(width * span * 4).fill(255);
const at = (c: number, r: number): number => height[Math.min(span - 1, Math.max(0, r)) * span + Math.min(span - 1, Math.max(0, c))]!;
panels.forEach((panel, index) => {
  for (let row = 0; row < span; row += 1) {
    for (let column = 0; column < span; column += 1) {
      const t = (y0 + row) * fine.columns + x0 + column;
      const b = panel === 'truth' ? truth.biome[t]! : biome[row * span + column]!;
      const w = panel === 'truth' ? truth.water[t]! : water[row * span + column]!;
      const shade = 1 + Math.max(-0.3, Math.min(0.3, (at(column - 1, row - 1) - at(column + 1, row + 1)) * 14));
      const [r, g, bl] = colour(b, w, shade);
      pixels.set([r, g, bl, 255], (row * width + index * (span + 8) + column) * 4);
    }
  }
});
writeFileSync(out, encodePng(pixels, width, span));
let lt = 0, lw = 0;
for (let row = 0; row < span; row += 1) for (let column = 0; column < span; column += 1) {
  if (truth.water[(y0 + row) * fine.columns + x0 + column] === Water.Lake) lt += 1;
  if (water[row * span + column] === Water.Lake) lw += 1;
}
console.log(`lake tiles: truth ${lt}, windows ${lw}`);
