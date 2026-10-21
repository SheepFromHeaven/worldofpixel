import { createGrid, put } from '../grid.ts';
import type { Grid } from '../grid.ts';
import { fbm, hash } from '../ground/periodic.ts';
import type { Ramp } from '../color.ts';
import { FELT, PAPER, STONE_WARM } from '../palette.ts';
import { SURFACE_CELLS, SURFACE_NAMES } from './metrics.ts';
import type { SurfaceName } from './metrics.ts';

/**
 * What a panel is actually made of, as a square that tiles.
 *
 * A plate is a rail — four corners and four edges, nine-sliced — and its middle is *stretched*,
 * so nothing with any grain in it can live there: a fleck in the middle cell comes out as a
 * streak the length of the panel. That is why every panel in the HUD has been a flat colour, and
 * why a sandstone slab read as a brown rectangle. The face is laid behind the rail instead, as a
 * background that repeats at the size it was baked, and the rail's inner cells are this
 * surface's own base step so the two meet with no seam.
 *
 * **Fields are code, marks are rows** — the same rule as the ground. A thousand cells that have
 * to wrap at all four edges are not drawn by hand, and what is worth deciding about a stone is a
 * handful of numbers: how wide its bedding runs, how often it is pitted, how far the grain
 * strays from the face.
 */
const step = (ramp: Ramp, index: number) =>
  ramp[Math.max(0, Math.min(ramp.length - 1, index))] ?? ramp[0]!;

/** Noise over the tile, in cells across and cells down, so a band can be wider than it is tall. */
const grain = (x: number, y: number, across: number, down: number, salt: number): number =>
  fbm(x, y, SURFACE_CELLS, across, 2, salt, down);

function surface(paint: (x: number, y: number) => number, ramp: Ramp): Grid {
  const grid = createGrid(SURFACE_CELLS);
  for (let y = 0; y < SURFACE_CELLS; y += 1) {
    for (let x = 0; x < SURFACE_CELLS; x += 1) put(grid, x, y, step(ramp, paint(x, y)));
  }
  return grid;
}

/**
 * Sandstone: bedding first, then the sand it is made of, then the pits.
 *
 * The bands are wider than they are tall because that is what a sedimentary stone is — laid down
 * flat and cut across. Without them the speckle alone reads as noise on a brown rectangle, which
 * is what it was; the bands are what make it a slab with a history.
 */
const sandstone = (): Grid =>
  surface((x, y) => {
    const bedding = grain(x, y, 2, 9, 0x5a1d);
    const speck = hash(x, y, 0x2f77);
    // One step either way and no more: the slab carries writing, so the stone behind it is
    // kept to a faint bedding and the odd grain.
    if (bedding < 0.22) return 4;
    return speck > 0.99 ? 4 : 5;
  }, STONE_WARM);

/** Parchment: fibres pulled across the sheet as it was laid, and the odd dark fleck in the pulp. */
const parchment = (): Grid =>
  surface((x, y) => {
    const fibre = grain(x, y, 8, 3, 0x7b02);
    const fleck = hash(x, y, 0x11c3);
    // Laid at the second step rather than the fourth: a sheet beaten in a village is not the
    // white of a modern page, and black coal on white is the one pairing here with no material
    // in it at all.
    let index = 2;
    if (fibre < 0.22) index -= 1;
    else if (fibre > 0.8) index += 1;
    return fleck > 0.997 ? 0 : index;
  }, PAPER);

/** Felt, and the chalk that has been wiped across it: blotchy, never clean. */
const slate = (): Grid =>
  surface((x, y) => {
    const nap = grain(x, y, 5, 5, 0x3c51);
    const dust = hash(x, y, 0x6ae9);
    let index = 3;
    if (nap < 0.42) index -= 1;
    else if (nap > 0.64) index += 1;
    return dust > 0.99 ? 4 : index;
  }, FELT);

const DRAW: Record<SurfaceName, () => Grid> = { sandstone, parchment, slate };

export const surfaces = (): { name: SurfaceName; grid: Grid }[] =>
  SURFACE_NAMES.map((name) => ({ name, grid: DRAW[name]() }));
