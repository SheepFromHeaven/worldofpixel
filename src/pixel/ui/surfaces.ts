import type { Ramp } from '../color.ts';
import type { Grid } from '../grid.ts';
import { createGrid, put } from '../grid.ts';
import { fbm, hash } from '../ground/periodic.ts';
import { BOARD, FELT, PAPER, STONE_WARM } from '../palette.ts';
import type { SurfaceName } from './metrics.ts';
import { SURFACE_CELLS, SURFACE_NAMES } from './metrics.ts';

const step = (ramp: Ramp, index: number) =>
  ramp[Math.max(0, Math.min(ramp.length - 1, index))] ?? ramp[0]!;

const grain = (x: number, y: number, across: number, down: number, salt: number): number =>
  fbm(x, y, SURFACE_CELLS, across, 2, salt, down);

function surface(paint: (x: number, y: number) => number, ramp: Ramp): Grid {
  const grid = createGrid(SURFACE_CELLS);
  for (let y = 0; y < SURFACE_CELLS; y += 1) {
    for (let x = 0; x < SURFACE_CELLS; x += 1) put(grid, x, y, step(ramp, paint(x, y)));
  }
  return grid;
}

const sandstone = (): Grid =>
  surface((x, y) => {
    const bedding = grain(x, y, 2, 9, 0x5a1d);
    const speck = hash(x, y, 0x2f77);
    if (bedding < 0.22) return 4;
    return speck > 0.99 ? 4 : 5;
  }, STONE_WARM);

const parchment = (): Grid =>
  surface((x, y) => {
    const fibre = grain(x, y, 8, 3, 0x7b02);
    const fleck = hash(x, y, 0x11c3);
    let index = 2;
    if (fibre < 0.22) index -= 1;
    else if (fibre > 0.8) index += 1;
    return fleck > 0.997 ? 0 : index;
  }, PAPER);

const slate = (): Grid =>
  surface((x, y) => {
    const nap = grain(x, y, 5, 5, 0x3c51);
    const dust = hash(x, y, 0x6ae9);
    let index = 3;
    if (nap < 0.42) index -= 1;
    else if (nap > 0.64) index += 1;
    return dust > 0.99 ? 4 : index;
  }, FELT);

const PLANK_ROWS = 8;

const planks = (): Grid =>
  surface((x, y) => {
    const row = y % PLANK_ROWS;
    if (row === PLANK_ROWS - 1) return 0;
    if (row === 0) return 3;
    const plank = Math.floor(y / PLANK_ROWS);
    const streak = grain(x, y, 2, 16, 0x41a7 + plank);
    const knot = hash(Math.floor(x / 3), plank, 0x0b5e);
    if (knot > 0.985 && row > 1 && row < PLANK_ROWS - 2) return 1;
    if (streak < 0.3) return 1;
    return streak > 0.72 ? 3 : 2;
  }, BOARD);

const DRAW: Record<SurfaceName, () => Grid> = { sandstone, parchment, slate, planks };

export const surfaces = (): { name: SurfaceName; grid: Grid }[] =>
  SURFACE_NAMES.map((name) => ({ name, grid: DRAW[name]() }));
