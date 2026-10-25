import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { closeUpSprites } from '../src/pixel/ground/closeUp.ts';
import { encodePng } from '../src/pixel/png.ts';

const directory = resolve(process.cwd(), 'public/closeup');
mkdirSync(directory, { recursive: true });

const SHEET = 512;
const GAP = 2;

const sprites = closeUpSprites();
const placed: { name: string; x: number; y: number; size: number }[] = [];
let shelfX = 0;
let shelfY = 0;
let shelfHeight = 0;
for (const sprite of [...sprites].sort((a, b) => b.grid.size - a.grid.size)) {
  const { size } = sprite.grid;
  if (shelfX + size > SHEET) {
    shelfY += shelfHeight + GAP;
    shelfX = 0;
    shelfHeight = 0;
  }
  placed.push({ name: sprite.name, x: shelfX, y: shelfY, size });
  shelfX += size + GAP;
  shelfHeight = Math.max(shelfHeight, size);
}
const height = shelfY + shelfHeight;

const pixels = new Uint8Array(SHEET * height * 4);
for (const spot of placed) {
  const sprite = sprites.find((candidate) => candidate.name === spot.name)!;
  const { size, cells } = sprite.grid;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const colour = cells[y * size + x]!;
      if ((colour & 0xff) === 0) continue;
      const to = ((spot.y + y) * SHEET + spot.x + x) * 4;
      pixels[to] = (colour >>> 24) & 0xff;
      pixels[to + 1] = (colour >>> 16) & 0xff;
      pixels[to + 2] = (colour >>> 8) & 0xff;
      pixels[to + 3] = colour & 0xff;
    }
  }
}

writeFileSync(resolve(directory, 'sheet.png'), encodePng(pixels, SHEET, height));
writeFileSync(resolve(directory, 'sheet.json'), `${JSON.stringify({ sprites: placed }, null, 2)}\n`);
console.log(`closeup: ${placed.length} packed -> ${SHEET}x${height}`);
