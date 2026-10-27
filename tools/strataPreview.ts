import { writeFileSync } from 'node:fs';
import { encodePng } from '../src/pixel/png.ts';
import { CAVE_COLORS, MINERAL_COLORS, ROCK_COLORS } from '../src/render/palette.ts';
import { Cave } from '../src/sim/geology/caves.ts';
import { Geology, LEVEL_METRES } from '../src/sim/geology/geology.ts';
import type { Sample } from '../src/sim/geology/geology.ts';
import { World } from '../src/sim/world.ts';

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

const seed = Number(process.argv[2] ?? 20250214);
const originX = Number(process.argv[3] ?? 1000);
const originY = Number(process.argv[4] ?? 700);
const span = Number(process.argv[5] ?? 256);
const levels = (process.argv[6] ?? '1,4,10,20').split(',').map(Number);
const out = process.argv[7] ?? '/tmp/strata.png';

const world = World.generate(seed);
const started = performance.now();
const geology = new Geology(world);
console.log(`geology built in ${(performance.now() - started).toFixed(0)} ms`);

const SIDE = 384;
const scale = SIDE / span;
const width = SIDE * levels.length;
const sheet = new Uint8Array(width * SIDE * 4);
const sample: Sample = { rock: 0, mineral: 0, cave: 0, above: 0, life: 0 };
const counts = new Map<string, number>();

for (const [i, level] of levels.entries()) {
  const t0 = performance.now();
  for (let py = 0; py < SIDE; py += 1) {
    for (let px = 0; px < SIDE; px += 1) {
      const x = originX + px / scale;
      const y = originY + py / scale;
      if (process.env.PLANE) geology.sample(x, y, level, sample);
      else geology.sampleBelow(x, y, level * LEVEL_METRES, sample);
      if (sample.rock === 255) {
        const [wr, wg, wb] = sample.cave === Cave.Water ? rgb(CAVE_COLORS.water) : [60, 66, 60];
        sheet.set([wr, wg, wb, 255], (py * width + i * SIDE + px) * 4);
        continue;
      }
      let [r, g, b] = rgb(ROCK_COLORS[sample.rock]!);
      const shade = 0.88 + 0.12 * ((Math.floor(x * 2) * 7 + Math.floor(y * 2) * 13) % 5) / 4;
      r *= shade; g *= shade; b *= shade;
      if (sample.mineral !== 0 && ((Math.floor(x * 3) + Math.floor(y * 3)) % 2 === 0)) [r, g, b] = rgb(MINERAL_COLORS[sample.mineral]!);
      if (sample.cave === Cave.Open || sample.cave === Cave.Dripstone) [r, g, b] = rgb(sample.cave === Cave.Dripstone && (Math.floor(x * 2) + Math.floor(y * 2)) % 3 === 0 ? CAVE_COLORS.drip : CAVE_COLORS.void);
      if (sample.cave === Cave.Flooded) [r, g, b] = rgb(CAVE_COLORS.water);
      const to = (py * width + i * SIDE + px) * 4;
      sheet.set([r, g, b, 255], to);
      const key = `${level}:${sample.cave > 0 ? 'cave' : sample.mineral > 0 ? 'ore' : 'rock'}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  console.log(`level ${level}: ${(performance.now() - t0).toFixed(0)} ms`);
}

console.log([...counts.entries()].map(([k, n]) => `${k} ${(n / (SIDE * SIDE) * 100).toFixed(1)}%`).join('  '));
writeFileSync(out, encodePng(sheet, width, SIDE));
console.log(out);
