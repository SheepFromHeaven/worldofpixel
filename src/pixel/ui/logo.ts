import type { Rgba } from '../color.ts';
import { alphaOf } from '../color.ts';
import type { Grid } from '../grid.ts';
import { at, createGrid, put } from '../grid.ts';
import { FIRE, FOLIAGE, INK, PAPER, SHADOW, WATER } from '../palette.ts';
import { fontSheet } from './font.ts';
import { BOX, FIRST_CODE, FONT_COLS, GLYPH } from './metrics.ts';

const WIDTH = 176;
const HEIGHT = 128;

const GLOBE_RADIUS = 22;
const GLOBE_BLOCK = 2;
const TITLE_SCALE = 5;
const SUBTITLE_SCALE = 3;

const TITLE_ROWS = [6, 6, 5, 5, 4, 3, 3] as const;
const SUBTITLE_ROWS = [4, 4, 3, 3, 2, 1, 1] as const;

const glyphs = fontSheet();

function lit(character: string, x: number, y: number): boolean {
  const slot = character.charCodeAt(0) - FIRST_CODE;
  const left = (slot % FONT_COLS) * BOX.w;
  const top = Math.floor(slot / FONT_COLS) * BOX.h;
  return alphaOf(at(glyphs, left + x, top + y)) > 0;
}

function widthOf(text: string, scale: number): number {
  return text.length * BOX.w * scale - scale;
}

function letters(
  layer: Grid,
  text: string,
  left: number,
  top: number,
  scale: number,
  ramp: readonly Rgba[],
  rows: readonly number[],
): void {
  [...text].forEach((character, index) => {
    for (let y = 0; y < GLYPH.h; y += 1) {
      for (let x = 0; x < GLYPH.w; x += 1) {
        if (!lit(character, x, y)) continue;
        const color = ramp[rows[y]!]!;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            put(layer, left + index * BOX.w * scale + x * scale + dx, top + y * scale + dy, color);
          }
        }
      }
    }
  });
}

const solid = (grid: Grid, x: number, y: number): boolean => alphaOf(at(grid, x, y)) > 0;

function mounted(target: Grid, layer: Grid, depth: number): void {
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (solid(layer, x - depth, y - depth)) put(target, x, y, SHADOW);
    }
  }
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (solid(layer, x, y)) continue;
      const near =
        solid(layer, x - 1, y) || solid(layer, x + 1, y) || solid(layer, x, y - 1) || solid(layer, x, y + 1);
      if (near) put(target, x, y, INK);
    }
  }
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const color = at(layer, x, y);
      if (alphaOf(color) > 0) put(target, x, y, color);
    }
  }
}

const hashed = (x: number, y: number): number => {
  let h = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1274126177, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const smooth = (x: number, y: number): number => {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const tx = x - fx;
  const ty = y - fy;
  const ease = (t: number): number => t * t * (3 - 2 * t);
  const top = hashed(fx, fy) + (hashed(fx + 1, fy) - hashed(fx, fy)) * ease(tx);
  const bottom = hashed(fx, fy + 1) + (hashed(fx + 1, fy + 1) - hashed(fx, fy + 1)) * ease(tx);
  return top + (bottom - top) * ease(ty);
};

function globe(layer: Grid, centreX: number, centreY: number): void {
  const cells = Math.floor((GLOBE_RADIUS * 2) / GLOBE_BLOCK);
  for (let row = 0; row < cells; row += 1) {
    for (let column = 0; column < cells; column += 1) {
      const dx = (column + 0.5) / cells * 2 - 1;
      const dy = (row + 0.5) / cells * 2 - 1;
      const reach = dx * dx + dy * dy;
      if (reach > 1) continue;

      const light = Math.max(0, 1 - Math.hypot(dx + 0.45, dy + 0.45) / 1.5);
      const land = smooth(column * 0.32 + 3, row * 0.32 + 7) * 0.7 + smooth(column * 0.9, row * 0.9) * 0.3;
      const color =
        land > 0.56
          ? FOLIAGE[Math.min(3, Math.round(light * 3))]!
          : WATER[Math.min(5, 2 + Math.round(light * 3))]!;

      for (let y = 0; y < GLOBE_BLOCK; y += 1) {
        for (let x = 0; x < GLOBE_BLOCK; x += 1) {
          put(layer, centreX - GLOBE_RADIUS + column * GLOBE_BLOCK + x, centreY - GLOBE_RADIUS + row * GLOBE_BLOCK + y, color);
        }
      }
    }
  }
}

export function logoSheet(): { grid: Grid; width: number; height: number } {
  const grid = createGrid(WIDTH);
  const layer = createGrid(WIDTH);

  const title = 'WORLD';
  const subtitle = 'OF PIXELS';
  const titleTop = 2 * GLOBE_RADIUS + 10;

  globe(layer, WIDTH / 2, GLOBE_RADIUS + 4);
  letters(layer, title, Math.floor((WIDTH - widthOf(title, TITLE_SCALE)) / 2), titleTop, TITLE_SCALE, FIRE, TITLE_ROWS);
  letters(
    layer,
    subtitle,
    Math.floor((WIDTH - widthOf(subtitle, SUBTITLE_SCALE)) / 2),
    titleTop + GLYPH.h * TITLE_SCALE + 6,
    SUBTITLE_SCALE,
    PAPER,
    SUBTITLE_ROWS,
  );

  mounted(grid, layer, 2);
  return { grid, width: WIDTH, height: HEIGHT };
}
