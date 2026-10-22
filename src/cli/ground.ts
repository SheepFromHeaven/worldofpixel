import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DECALS, MASKS, TEXTURE, TEXTURES } from '../pixel/ground/index.ts';
import { PRIORITY } from '../pixel/ground/masks.ts';
import { STEPS } from '../pixel/ground/steps.ts';
import { encodePng } from '../pixel/png.ts';

const directory = resolve(process.cwd(), 'public/ground');
mkdirSync(directory, { recursive: true });

const COLUMNS = 8;
const STEP_GREY = 63;

function squares(count: number, paint: (index: number, put: (x: number, y: number, grey: number) => void) => void): { png: Buffer; width: number; height: number } {
  const width = Math.min(count, COLUMNS) * TEXTURE;
  const height = Math.ceil(count / COLUMNS) * TEXTURE;
  const pixels = new Uint8Array(width * height * 4);
  for (let index = 0; index < count; index += 1) {
    const left = (index % COLUMNS) * TEXTURE;
    const top = Math.floor(index / COLUMNS) * TEXTURE;
    paint(index, (x, y, grey) => {
      const at = ((top + y) * width + left + x) * 4;
      pixels[at] = grey;
      pixels[at + 1] = grey;
      pixels[at + 2] = grey;
      pixels[at + 3] = 0xff;
    });
  }
  return { png: encodePng(pixels, width, height), width, height };
}

const slot = (index: number): { x: number; y: number } => ({
  x: (index % COLUMNS) * TEXTURE,
  y: Math.floor(index / COLUMNS) * TEXTURE,
});

const textures = squares(TEXTURES.length, (index, put) => {
  const steps = TEXTURES[index]!.draw();
  for (let y = 0; y < TEXTURE; y += 1) {
    for (let x = 0; x < TEXTURE; x += 1) put(x, y, steps.get(x, y) * STEP_GREY);
  }
});

const masks = squares(MASKS.length, (index, put) => {
  const cells = MASKS[index]!.cells;
  for (let y = 0; y < TEXTURE; y += 1) {
    for (let x = 0; x < TEXTURE; x += 1) put(x, y, cells[y * TEXTURE + x]!);
  }
});

const SHEET = 512;
const GAP = 1;
const order = [...DECALS.keys()].sort((a, b) => DECALS[b]!.height - DECALS[a]!.height || a - b);
const placed = new Map<number, { x: number; y: number }>();
let shelfX = 0;
let shelfY = 0;
let shelfHeight = 0;
for (const index of order) {
  const decal = DECALS[index]!;
  if (decal.width > SHEET) throw new Error(`${decal.name}: ${decal.width} cells is wider than the ${SHEET} sheet`);
  if (shelfX + decal.width > SHEET) {
    shelfY += shelfHeight + GAP;
    shelfX = 0;
    shelfHeight = 0;
  }
  placed.set(index, { x: shelfX, y: shelfY });
  shelfX += decal.width + GAP;
  shelfHeight = Math.max(shelfHeight, decal.height);
}
const decalHeight = shelfY + shelfHeight;
const decalPixels = new Uint8Array(SHEET * decalHeight * 4);
for (const [index, decal] of DECALS.entries()) {
  const at = placed.get(index)!;
  for (let y = 0; y < decal.height; y += 1) {
    for (let x = 0; x < decal.width; x += 1) {
      const cell = decal.cells[y * decal.width + x]!;
      const to = ((at.y + y) * SHEET + at.x + x) * 4;
      decalPixels[to] = (cell >>> 24) & 0xff;
      decalPixels[to + 1] = (cell >>> 16) & 0xff;
      decalPixels[to + 2] = (cell >>> 8) & 0xff;
      decalPixels[to + 3] = cell & 0xff;
    }
  }
}

const manifest = {
  texture: TEXTURE,
  steps: STEPS,
  stepGrey: STEP_GREY,
  priority: PRIORITY,
  textures: TEXTURES.map((texture, index) => ({
    name: texture.name,
    material: texture.material,
    ...(texture.ridge ? { ridge: texture.ridge } : {}),
    ...slot(index),
  })),
  masks: MASKS.map((mask, index) => ({ material: mask.material, ...slot(index) })),
  decals: DECALS.map((decal, index) => ({
    name: decal.name,
    ...placed.get(index)!,
    width: decal.width,
    height: decal.height,
    foot: decal.foot,
    density: decal.density,
    stands: decal.stands,
  })),
};

writeFileSync(resolve(directory, 'textures.png'), textures.png);
writeFileSync(resolve(directory, 'masks.png'), masks.png);
writeFileSync(resolve(directory, 'decals.png'), encodePng(decalPixels, SHEET, decalHeight));
writeFileSync(resolve(directory, 'ground.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`textures: ${TEXTURES.length} at ${TEXTURE}x${TEXTURE} -> ${textures.width}x${textures.height}`);
console.log(`masks:    ${MASKS.length} at ${TEXTURE}x${TEXTURE} -> ${masks.width}x${masks.height}`);
console.log(`decals:   ${DECALS.length} packed -> ${SHEET}x${decalHeight}`);
