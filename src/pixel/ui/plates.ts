import type { Grid } from '../grid.ts';
import { createGrid } from '../grid.ts';
import { paint } from './art.ts';
import type { PlateName } from './metrics.ts';
import { PLATE_CELLS, PLATE_NAMES, PLATE_SLICE } from './metrics.ts';

const RING = [
  '............',
  '...##..##...',
  '..#......#..',
  '.#........#.',
  '.#........#.',
  '............',
  '............',
  '.#........#.',
  '.#........#.',
  '..#......#..',
  '...##..##...',
  '............',
] as const;

function ringRows(groove: string, lit: string): readonly string[] {
  const cells = RING.map((row) => [...row].map((cell) => (cell === '#' ? groove : '.')));

  if (lit !== '.') {
    RING.forEach((row, y) => {
      [...row].forEach((cell, x) => {
        if (cell !== '#') return;
        const below = cells[y + 1];
        if (below && below[x + 1] === '.') below[x + 1] = lit;
      });
    });
  }

  return cells.map((row) => row.join(''));
}

const PLATES: Record<PlateName, readonly string[]> = {
  board: [
    'KKKKKKKKKKKK',
    'KTTTTTTTTTtK',
    'KTttttttttTK',
    'KTtKKKKKKttK',
    'KTtKVVVVKttK',
    'KTtKVVVVKttK',
    'KTtKVVVVKttK',
    'KTtKVVVVKttK',
    'KTtKKKKKKttK',
    'KTTTTTTTTTtK',
    'KTttttttttTK',
    'KKKKKKKKKKKK',
  ],

  slab: [
    '..KKKKKKKK..',
    '.KMMMMMMMMK.',
    'KMMAAAAAAmmK',
    'KMAAAAAAAAmK',
    'KMAAAAAAAAmK',
    'KMAAAAAAAAmK',
    'KMAAAAAAAAmK',
    'KMAAAAAAAAmK',
    'KMAAAAAAAAmK',
    'KMAAAAAAAAmK',
    '.KmmmmmmmmK.',
    '..KKKKKKKK..',
  ],

  sheet: [
    '.nnnnnnnnnn.',
    'nPPPPPPPPPPn',
    'nPpppppppppn',
    'nPpppppppppn',
    'nPpppppppppn',
    'nPpppppppppn',
    'nPpppppppppn',
    'nPpppppppppn',
    'nPpppppppppn',
    'nPpppppppppn',
    'nnnnnnnnnnnn',
    '.nnnnnnnnnn.',
  ],

  tile: [
    'KKKKKKKKKKKK',
    'K6666666652K',
    'K6544444432K',
    'K6544444432K',
    'K6544444432K',
    'K6544444432K',
    'K6544444432K',
    'K6544444432K',
    'K6544444432K',
    'K6544444432K',
    'K3222222222K',
    'KKKKKKKKKKKK',
  ],

  'tile-hover': [
    'KKKKKKKKKKKK',
    'K6666666653K',
    'K6555555543K',
    'K6555555543K',
    'K6555555543K',
    'K6555555543K',
    'K6555555543K',
    'K6555555543K',
    'K6555555543K',
    'K6555555543K',
    'K4333333333K',
    'KKKKKKKKKKKK',
  ],

  'tile-on': [
    'KKKKKKKKKKKK',
    'KRRRRRRRRRQK',
    'KRrrrrrrrrQK',
    'KRrrrrrrrrQK',
    'KRrrrrrrrrQK',
    'KRrrrrrrrrQK',
    'KRrrrrrrrrQK',
    'KRrrrrrrrrQK',
    'KRrrrrrrrrQK',
    'KRrrrrrrrrQK',
    'KQQQQQQQQQQK',
    'KKKKKKKKKKKK',
  ],

  'tile-off': [
    'KKKKKKKKKKKK',
    'K2222222222K',
    'K2333333332K',
    'K2333333332K',
    'K2333333332K',
    'K2333333332K',
    'K2333333332K',
    'K2333333332K',
    'K2333333332K',
    'K2333333332K',
    'K2222222222K',
    'KKKKKKKKKKKK',
  ],

  field: [
    'KKKKKKKKKKKK',
    'K1111111112K',
    'K1555555553K',
    'K1555555553K',
    'K1555555553K',
    'K1555555553K',
    'K1555555553K',
    'K1555555553K',
    'K1555555553K',
    'K1555555553K',
    'K3333333333K',
    'KKKKKKKKKKKK',
  ],

  slot: [
    'KKKKKKKKKKKK',
    'KvvvvvvvvvVK',
    'KvVVVVVVVVVK',
    'KvVVVVVVVVVK',
    'KvVVVVVVVVVK',
    'KvVVVVVVVVVK',
    'KvVVVVVVVVVK',
    'KvVVVVVVVVVK',
    'KvVVVVVVVVVK',
    'KvVVVVVVVVVK',
    'KVVVVVVVVVVK',
    'KKKKKKKKKKKK',
  ],

  'ring-slab': ringRows('R', 'M'),
  'ring-sheet': ringRows('R', '.'),
  'ring-board': ringRows('Q', '.'),

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
