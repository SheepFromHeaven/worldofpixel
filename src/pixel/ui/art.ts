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

/**
 * The HUD is drawn out as rows of characters rather than lists of coordinates.
 *
 * The sprites on the map are shaded — a mask, a material and a light — because they are objects
 * standing in the world. An icon is not: at sixteen cells every pixel is a decision, and a row
 * of letters is the only form in which that decision can be *read* in the diff. The legend is
 * shared across every drawing here for the same reason the ramps are shared: two icons that each
 * invent their own brown are two kinds of wood on one bar.
 */
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

/**
 * Bone is the one material written as its own step rather than as a letter.
 *
 * Every plate and every tile in the HUD is cut from it, and a bevel is the whole drawing: three
 * steps of the same ramp are what make a face, a lit edge and a shaded one. Named `0`–`6` so a
 * row of art reads as the heights it is describing — `0556` is a corner going up — where four
 * arbitrary letters would have to be looked up every time the bevel changed.
 */
BONE.forEach((step, index) => {
  LEGEND[String(index)] = step;
});

/**
 * Lays a drawing into a grid with its top-left corner at `x, y`.
 *
 * Every row is checked for length and every character for a legend entry. A drawing authored by
 * hand goes wrong by a column at a time, and a silently short row is a shape that leans — which
 * is far harder to see on a 32-pixel icon than an exception is to read.
 */
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
