import { CLEAR, alphaOf } from '../color.ts';
import type { Rgba } from '../color.ts';
import { FOLIAGE, WOOD } from '../palette.ts';
import { LEGEND } from '../ui/art.ts';
import { STEPS } from './steps.ts';
import type { Material } from './textures.ts';

/**
 * A thing lying or growing on the ground: a flower, a fern, a stone, a tree.
 *
 * Its cells are colours, with one exception that is most of the point: a cell can instead be a
 * *step of the ground's ramp*. A shadow, a clump of clover or the base of a tuft takes its colour
 * from whatever biome it lands on, so the same tuft belongs on a meadow and on a marsh, and a
 * tree's shadow is a darker patch of the grass under it rather than a grey stain over it.
 *
 * Packed into the alpha: 0 is clear, 1–5 is ground step 0–4, 255 is a colour of its own.
 * Nothing else is ever written, so the renderer can tell the three apart with one comparison.
 */
export interface Decal {
  name: string;
  width: number;
  height: number;
  /** The cell that stands on the point it was placed at — the foot of the stem, the trunk. */
  foot: { x: number; y: number };
  /**
   * How many to a parcel, on average, on each ground it grows on — and the ground it is found on
   * at all is the keys. A parcel is 32 texels across, so a density of 1 is one flower in a patch
   * the size of a well. Per ground rather than one number because an oak is the forest and a rare
   * thing in a meadow, and those are two different counts of the same drawing.
   */
  density: Partial<Record<Material, number>>;
  /**
   * Whether it stands up off the ground — a tree, a bush, a boulder — so that something walking
   * past can be in front of it or behind it. A flower lies flat and is baked into the ground; a
   * tree is drawn with the town, in order of where everything stands.
   */
  stands: boolean;
  cells: Uint32Array;
}

export const groundStep = (step: number): Rgba => (Math.max(0, Math.min(STEPS - 1, step)) + 1) >>> 0;

/** The ground step a cell stands for, or -1 when it is clear or a colour of its own. */
export function stepOf(cell: Rgba): number {
  const alpha = alphaOf(cell);
  return alpha >= 1 && alpha <= STEPS ? alpha - 1 : -1;
}

/**
 * The HUD's letters, so a red here is the HUD's red, plus the two greens and the brown it has no
 * letter for. Digits are *not* the HUD's: there they are bone, here they are the ground.
 */
const LETTERS: Record<string, Rgba> = {
  ...Object.fromEntries(Object.entries(LEGEND).filter(([key]) => !/\d/.test(key))),
  j: FOLIAGE[0]!,
  J: FOLIAGE[2]!,
  m: WOOD[1]!,
};

/** Reads rows into cells: `.` clear, `0`–`4` the ground's own steps, any letter its colour. */
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
  // Stood on the bottom row, at its middle: the stem goes into the ground there.
  return { name, width, height, foot: { x: Math.floor(width / 2), y: height - 1 }, density, stands: false, cells };
}

/**
 * The small things, a texel to a hand's breadth.
 *
 * A flower head is one texel and a clump of them a handful, which is what they are beside a
 * villager sixteen texels tall. Lit from the top-left like everything else: a lit cell up and to
 * the left, its shadow, in the ground's darkest steps, down and to the right.
 */
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

  mark('highland.rocks', { highland: 1, tundra: 1 }, [
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
  mark('desert.scrub', { desert: 0.6 }, [
    '.W.W..',
    'W.w.W.',
    '.WwW.w',
    'w.W.w0',
    '..00..',
  ]),
  mark('desert.stones', { desert: 0.4 }, [
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

  mark('path.pebbles', { path: 1 }, [
    'S..',
    '0.Y',
    '.e0',
  ]),
];
