import { writeFileSync } from 'node:fs';
import { encodePng } from '../pixel/png.ts';
import { provideGroundSprites } from '../render/groundSprites.ts';
import { LEVELS, texelsIn } from '../render/terrainPixels.ts';
import { World } from '../sim/world.ts';
import { groundFromSource } from './groundSource.ts';

provideGroundSprites(groundFromSource());

const world = World.generate(Number(process.argv[2] ?? 20250214));
const originX = Number(process.argv[3] ?? 1000);
const originY = Number(process.argv[4] ?? 700);
const span = Number(process.argv[5] ?? 60);

const SIDE = 256;
const scale = SIDE / span;
const width = SIDE * LEVELS.length;
const sheet = new Uint8Array(width * SIDE * 4);

for (const [i, level] of LEVELS.entries()) {
  const { texel } = level;
  const started = performance.now();
  const fromX = Math.floor(originX / texel);
  const fromY = Math.floor(originY / texel);
  const cells = Math.ceil(span / texel) + 1;
  const texels = texelsIn(world, texel, fromX, fromY, cells, cells);

  for (let y = 0; y < SIDE; y += 1) {
    for (let x = 0; x < SIDE; x += 1) {
      const tx = Math.min(cells - 1, Math.max(0, Math.floor((originX + x / scale) / texel) - fromX));
      const ty = Math.min(cells - 1, Math.max(0, Math.floor((originY + y / scale) / texel) - fromY));
      const c = texels[ty * cells + tx]!;
      const to = (y * width + i * SIDE + x) * 4;
      sheet.set([(c >>> 24) & 0xff, (c >>> 16) & 0xff, (c >>> 8) & 0xff, c & 0xff], to);
    }
  }

  console.log(
    `${level.detail.padEnd(7)} ${String(level.texels).padStart(2)} texels/tile — ` +
    `texel ${texel.toFixed(4)} metres — from zoom ${(1 / texel).toFixed(2)} — ` +
    `${(performance.now() - started).toFixed(0)}ms`,
  );
}

writeFileSync('/tmp/tiers.png', encodePng(sheet, width, SIDE));
