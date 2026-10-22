import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { CLEAR } from '../pixel/color.ts';
import type { Rgba } from '../pixel/color.ts';
import { at, createGrid, magnify, put } from '../pixel/grid.ts';
import type { Grid } from '../pixel/grid.ts';
import { FOLIAGE, STONE_WARM } from '../pixel/palette.ts';
import { encodePng } from '../pixel/png.ts';
import { fontSheet } from '../pixel/ui/font.ts';
import { BOX, FIRST_CODE, FONT_COLS, GLYPH, PLATE_CELLS, PLATE_SLICE, SURFACE_CELLS } from '../pixel/ui/metrics.ts';
import { plateGrid } from '../pixel/ui/plates.ts';
import { surfaces } from '../pixel/ui/surfaces.ts';

const PANELS = [
  { plate: 'slab', face: 'sandstone', ink: STONE_WARM[0]!, lit: STONE_WARM[6]!, etched: true },
  { plate: 'sheet', face: 'parchment', ink: 0x2b2519ff, lit: CLEAR, etched: false },
  { plate: 'board', face: 'slate', ink: 0xd6e2d6ff, lit: CLEAR, etched: false },
] as const;

const WIDE = 76;
const TALL = 34;
const GAP = 4;
const SCALE = 3;

const font = fontSheet();
const faces = new Map(surfaces().map((face) => [face.name, face.grid]));

function rail(page: Grid, plate: Grid, left: number, top: number, w: number, h: number): void {
  const s = PLATE_SLICE;
  const far = PLATE_CELLS - s;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const sx = x < s ? x : x >= w - s ? PLATE_CELLS - (w - x) : s + ((x - s) % s);
      const sy = y < s ? y : y >= h - s ? PLATE_CELLS - (h - y) : s + ((y - s) % s);
      const edge = x < s || y < s || x >= w - s || y >= h - s;
      if (!edge) continue;
      const color = at(plate, Math.min(sx, PLATE_CELLS - 1), Math.min(sy, far + s - 1));
      if (color !== CLEAR) put(page, left + x, top + y, color);
    }
  }
}

function face(page: Grid, grid: Grid, left: number, top: number, w: number, h: number): void {
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      put(page, left + x, top + y, at(grid, (x + left) % SURFACE_CELLS, (y + top) % SURFACE_CELLS));
    }
  }
}

function write(page: Grid, text: string, left: number, top: number, ink: Rgba, lit: Rgba): void {
  let x = left;
  for (const character of text) {
    const slot = (character.codePointAt(0) ?? 32) - FIRST_CODE;
    const col = slot % FONT_COLS;
    const row = Math.floor(slot / FONT_COLS);
    for (let gy = 0; gy < BOX.h; gy += 1) {
      for (let gx = 0; gx < GLYPH.w; gx += 1) {
        if (at(font, col * BOX.w + gx, row * BOX.h + gy) === CLEAR) continue;
        if (lit !== CLEAR) put(page, x + gx + 1, top + gy + 1, lit);
        put(page, x + gx, top + gy, ink);
      }
    }
    x += GLYPH.w + 1;
  }
}

const page = createGrid(Math.max(PANELS.length * (WIDE + GAP) + GAP, TALL + GAP * 2));
for (let y = 0; y < page.size; y += 1) {
  for (let x = 0; x < page.size; x += 1) put(page, x, y, FOLIAGE[1]!);
}

PANELS.forEach((panel, index) => {
  const left = GAP + index * (WIDE + GAP);
  const top = GAP;
  const grid = faces.get(panel.face);
  if (grid) face(page, grid, left + PLATE_SLICE, top + PLATE_SLICE, WIDE - PLATE_SLICE * 2, TALL - PLATE_SLICE * 2);
  rail(page, plateGrid(panel.plate), left, top, WIDE, TALL);
  write(page, 'Eskwick', left + 7, top + 7, panel.ink, panel.lit);
  write(page, 'Water x64', left + 7, top + 18, panel.ink, panel.lit);
});

const out = resolve(process.cwd(), process.argv[2] ?? 'ledgers.png');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, encodePng(magnify(page, SCALE), page.size * SCALE, page.size * SCALE));
console.log(`${out}: ${page.size}x${page.size} at ${SCALE}x`);
