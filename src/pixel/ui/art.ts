import { CLEAR } from '../color.ts';
import type { Rgba } from '../color.ts';
import { put } from '../grid.ts';
import type { Grid } from '../grid.ts';
import {
  BOARD,
  BONE,
  CLOTH,
  EMBER,
  EARTH,
  FELT,
  FIRE,
  FOLIAGE,
  INK,
  PAPER,
  RED,
  SKIN,
  STONE,
  STONE_WARM,
  WATER,
  WOOD,
} from '../palette.ts';

export const LEGEND: Record<string, Rgba> = {
  '.': CLEAR,
  K: INK,
  d: STONE[0]!,
  s: STONE[3]!,
  S: STONE[5]!,
  A: STONE_WARM[5]!,
  m: STONE_WARM[3]!,
  M: STONE_WARM[6]!,
  x: EARTH[0]!,
  e: EARTH[1]!,
  E: EARTH[3]!,
  Y: EARTH[4]!,
  w: WOOD[0]!,
  W: WOOD[2]!,
  o: WOOD[3]!,
  b: WATER[2]!,
  B: WATER[5]!,
  l: WATER[7]!,
  f: FIRE[2]!,
  F: FIRE[5]!,
  i: FIRE[7]!,
  g: FOLIAGE[1]!,
  G: FOLIAGE[3]!,
  h: SKIN[1]!,
  H: SKIN[3]!,
  c: CLOTH[2]!,
  C: CLOTH[4]!,
  N: PAPER[0]!,
  n: PAPER[1]!,
  p: PAPER[2]!,
  P: PAPER[3]!,
  q: PAPER[4]!,
  r: RED,
  R: EMBER[0]!,
  Q: EMBER[3]!,
  v: FELT[1]!,
  V: FELT[3]!,
  t: BOARD[1]!,
  T: BOARD[3]!,
};

BONE.forEach((step, index) => {
  LEGEND[String(index)] = step;
});

export function paint(grid: Grid, x: number, y: number, rows: readonly string[], width: number): void {
  rows.forEach((row, dy) => {
    if (row.length !== width) {
      throw new Error(`art: row ${dy} is ${row.length} cells, expected ${width}`);
    }
    for (let dx = 0; dx < width; dx += 1) {
      const key = row[dx]!;
      const color = LEGEND[key];
      if (color === undefined) throw new Error(`art: no legend entry for "${key}"`);
      if (color !== CLEAR) put(grid, x + dx, y + dy, color);
    }
  });
}
