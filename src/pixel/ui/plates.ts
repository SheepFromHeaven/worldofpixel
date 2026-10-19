import { createGrid } from '../grid.ts';
import type { Grid } from '../grid.ts';
import { paint } from './art.ts';
import { PLATE_CELLS, PLATE_NAMES, PLATE_SLICE } from './metrics.ts';
import type { PlateName } from './metrics.ts';

/**
 * The panels and buttons, as nine cells square: a corner, a cell of edge, a corner.
 *
 * CSS stretches the middle row and the middle column and leaves the four corners alone, so the
 * three rows of each band have to be the same across their width — anything that varies there
 * comes out as a streak the length of the panel. The corners are where the shape lives: a cell
 * bitten out of each is the whole of the rounding, and it is the same rounding at every size
 * because it is never stretched.
 */
const PLATES: Record<PlateName, readonly string[]> = {
  panel: [
    '..KKKKK..',
    '.KqqqqqK.',
    'KqqqqqqqK',
    'KqqqqqqqK',
    'KqqqqqqqK',
    'KqqqqqqqK',
    'KqPPPPPqK',
    '.KPpppPK.',
    '..KKKKK..',
  ],
  button: [
    '..KKKKK..',
    '.KqqqqqK.',
    'KqqPPPppK',
    'KqPPPPPpK',
    'KqPPPPPpK',
    'KqPPPPPpK',
    'KqPPPPPpK',
    '.KpppppK.',
    '..KKKKK..',
  ],
  'button-hover': [
    '..KKKKK..',
    '.KqqqqqK.',
    'KqqqqqqqK',
    'KqqqqqqqK',
    'KqqqqqqqK',
    'KqqqqqqqK',
    'KqqqqqqqK',
    '.KPPPPPK.',
    '..KKKKK..',
  ],
  // The one plate that is not parchment: a pressed tool is the colour of the pencil that marks
  // the map, so what is selected and what it will draw are the same red.
  'button-on': [
    '..rrrrr..',
    '.rppppPr.',
    'rppppppPr',
    'rppppppPr',
    'rppppppPr',
    'rppppppPr',
    'rppppppPr',
    '.rppppPr.',
    '..rrrrr..',
  ],
  field: [
    '..KKKKK..',
    '.KnpppnK.',
    'KnppppppK',
    'KnppppppK',
    'KnppppppK',
    'KnppppppK',
    'KnppppppK',
    '.KpppppK.',
    '..KKKKK..',
  ],
};

export function plateGrid(name: PlateName): Grid {
  const rows = PLATES[name];
  if (rows.length !== PLATE_CELLS) {
    throw new Error(`plate ${name}: ${rows.length} rows, expected ${PLATE_CELLS}`);
  }
  if (PLATE_CELLS !== PLATE_SLICE * 3) {
    throw new Error(`plate: ${PLATE_CELLS} cells is not three slices of ${PLATE_SLICE}`);
  }
  const grid = createGrid(PLATE_CELLS);
  paint(grid, 0, 0, rows, PLATE_CELLS);
  return grid;
}

export const plates = (): { name: PlateName; grid: Grid }[] =>
  PLATE_NAMES.map((name) => ({ name, grid: plateGrid(name) }));
