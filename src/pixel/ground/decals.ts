import type { Rgba } from '../color.ts';
import { CLEAR, alphaOf } from '../color.ts';
import { FOLIAGE, WOOD } from '../palette.ts';
import { LEGEND } from '../ui/art.ts';
import { STEPS } from './steps.ts';
import type { Material } from './textures.ts';

export interface Decal {
  name: string;
  width: number;
  height: number;
  foot: { x: number; y: number };
  density: Partial<Record<Material, number>>;
  stands: boolean;
  cells: Uint32Array;
}

export const groundStep = (step: number): Rgba => (Math.max(0, Math.min(STEPS - 1, step)) + 1) >>> 0;

export function stepOf(cell: Rgba): number {
  const alpha = alphaOf(cell);
  return alpha >= 1 && alpha <= STEPS ? alpha - 1 : -1;
}

const LETTERS: Record<string, Rgba> = {
  ...Object.fromEntries(Object.entries(LEGEND).filter(([key]) => !/\d/.test(key))),
  j: FOLIAGE[0]!,
  J: FOLIAGE[2]!,
  m: WOOD[1]!,
};

export function rows(art: readonly string[]): { width: number; height: number; cells: Uint32Array } {
  const width = art[0]?.length ?? 0;
  const cells = new Uint32Array(width * art.length);
  art.forEach((row, y) => {
    if (row.length !== width) throw new Error(`decal: row ${y} is ${row.length} cells, expected ${width}`);
    for (let x = 0; x < width; x += 1) {
      const key = row[x]!;
      if (key === '.') continue;
      const step = Number(key);
      if (Number.isInteger(step) && step >= 0 && step < STEPS) {
        cells[y * width + x] = groundStep(step);
        continue;
      }
      const color = LETTERS[key];
      if (color === undefined) throw new Error(`decal: no legend entry for "${key}"`);
      cells[y * width + x] = color === CLEAR ? 0 : color;
    }
  });
  return { width, height: art.length, cells };
}

function mark(name: string, density: Decal['density'], art: readonly string[]): Decal {
  const { width, height, cells } = rows(art);
  return { name, width, height, foot: { x: Math.floor(width / 2), y: height - 1 }, density, stands: false, cells };
}

export const MARKS: readonly Decal[] = [
  mark('meadow.flowers.yellow', { meadow: 1.6 }, [
    '.F...F',
    'F1.i1.',
    '.1F.1.',
    '..1...',
  ]),
  mark('meadow.flowers.white', { meadow: 1.6 }, [
    '.q..q.',
    'q1.P1.',
    '.1.q1.',
    '...1..',
  ]),
  mark('meadow.flowers.red', { meadow: 0.8 }, [
    '.r...',
    'R1.r.',
    '.1.R1',
    '...1.',
  ]),
  mark('meadow.flowers.blue', { meadow: 0.8 }, [
    '.B..',
    'b1.B',
    '.1.1',
  ]),
  mark('meadow.clover', { meadow: 1.2 }, [
    '.3.3.',
    '323.3',
    '.2.32',
    '..2..',
  ]),
  mark('meadow.tuft', { meadow: 1.5, highland: 1.5, path: 1.5 }, [
    '3.3',
    '232',
    '1.1',
  ]),
  mark('meadow.stone', { meadow: 0.4, path: 0.4 }, [
    'SS.',
    'Ss0',
    '.0.',
  ]),

  mark('forest.fern', { forest: 1.4 }, [
    '...3.3...',
    '.33.3.33.',
    '3..323..3',
    '.2.2.2.2.',
    '2..212..2',
    '...010...',
  ]),
  mark('forest.mushrooms.red', { forest: 0.4 }, [
    'Qr..',
    'rR0r',
    '.q0R',
    '...0',
  ]),
  mark('forest.mushrooms.brown', { forest: 0.5, marsh: 0.5 }, [
    'Y...',
    'EeY.',
    '.p0E',
    '...e',
  ]),
  mark('forest.leaves', { forest: 1.2 }, [
    '.F..',
    'f..F',
    '..f.',
  ]),
  mark('forest.stump', { forest: 0.15 }, [
    '.eeeeee.',
    'eYoWWoYe',
    'eoYooYoe',
    '.eYYYYe.',
    'emEEEEme',
    'emEeeEme',
    '.memmem0',
    '..00000.',
  ]),
  mark('forest.log', { forest: 0.12 }, [
    '.eee........',
    'eYoYeeeeeee.',
    'eoWoEEEEEEEe',
    'eYoYmmmmmmme',
    '.eeeeeeeeee0',
    '..0000000000',
  ]),

  mark('highland.rocks', { highland: 1, tundra: 1, rock: 1.6, karst: 0.7, volcanic: 1.1, badlands: 0.7 }, [
    '.SS...',
    'SSs0S.',
    '.sd0Ss',
    '..0.d0',
  ]),
  mark('highland.heather', { highland: 0.6 }, [
    '.Q.Q.',
    'Q1R.Q',
    '.R1R.',
    '..1..',
  ]),
  mark('highland.tussock', { highland: 1.2, tundra: 1.2 }, [
    '.3.3.',
    '3.3.3',
    '.232.',
    '..1..',
  ]),

  mark('marsh.reeds', { marsh: 1.2 }, [
    '.W...',
    '.W.W.',
    '.3.W.',
    'W3.3.',
    'W3.3.',
    '.3.33',
    '3.3.3',
    '.2.2.',
    '..1..',
  ]),
  mark('marsh.puddle', { marsh: 0.7 }, [
    '.000.',
    '0l000',
    '00000',
    '.000.',
  ]),
  mark('marsh.sedge', { marsh: 1.4 }, [
    '3..3',
    '.3.3',
    '3.33',
    '.22.',
    '.1..',
  ]),

  mark('tundra.lichen', { tundra: 0.4, highland: 0.3 }, [
    '.f.',
    'fFf',
    '.f.',
  ]),
  mark('tundra.stone', { tundra: 0.6 }, [
    '.qS.',
    'qSSs',
    '.ss0',
    '..0.',
  ]),
  mark('tundra.twig', { tundra: 0.3, marsh: 0.3 }, [
    'w...',
    '.w.w',
    '..w.',
  ]),

  mark('desert.cactus', { desert: 0.25 }, [
    '..G...',
    '.GgG..',
    'G.gJ.G',
    'J.gj.J',
    'gJgjJj',
    '..gj..',
    '..jj00',
    '...00.',
  ]),
  mark('desert.barrel', { desert: 0.3 }, [
    '.G..',
    'GgG.',
    'gJj0',
    '.j0.',
  ]),
  mark('desert.scrub', { desert: 0.6, badlands: 0.35, karst: 0.25 }, [
    '.W.W..',
    'W.w.W.',
    '.WwW.w',
    'w.W.w0',
    '..00..',
  ]),
  mark('desert.stones', { desert: 0.4, badlands: 0.5, salt: 0.15 }, [
    'YE..',
    'Ee0Y',
    '.0Ee',
    '...0',
  ]),
  mark('desert.flower', { desert: 0.3 }, [
    '.F.',
    'F1i',
    '.1.',
  ]),

  mark('rock.lichen', { rock: 0.9, karst: 0.35 }, [
    '.Y.',
    'YFY',
    '.Y.',
  ]),
  mark('rock.moss', { rock: 0.5 }, [
    '.j.',
    'jJj',
    '.0.',
  ]),
  mark('karst.fern', { karst: 0.35 }, [
    '3.3',
    '232',
    '.1.',
  ]),
  mark('karst.shard', { karst: 0.8 }, [
    'q4.',
    'SqS',
    '.0.',
  ]),
  mark('volcanic.cinders', { volcanic: 1.3 }, [
    'dS.',
    '0d0',
    '.0.',
  ]),
  mark('volcanic.ember', { volcanic: 0.12 }, [
    'R.',
    '.Q',
  ]),
  mark('salt.crystals', { salt: 1.1 }, [
    'q.P',
    '.P.',
    'q.q',
  ]),
  mark('salt.puddle', { salt: 0.1 }, [
    '.lll.',
    'lbllb',
    'lllll',
    '.lll.',
  ]),
  mark('badlands.shard', { badlands: 1 }, [
    'Ee.',
    'Y0E',
    '.0.',
  ]),

  mark('path.pebbles', { path: 1 }, [
    'S..',
    '0.Y',
    '.e0',
  ]),
];
