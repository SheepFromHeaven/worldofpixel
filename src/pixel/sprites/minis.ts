import type { Rgba } from '../color.ts';
import { CLEAR } from '../color.ts';
import type { Grid } from '../grid.ts';
import { createGrid, put } from '../grid.ts';
import type { Light } from '../light.ts';
import {
  CHAR,
  CLOTH,
  EARTH,
  EMBER,
  FIRE,
  FOLIAGE,
  INK,
  RED,
  SHADOW,
  STONE,
  STONE_WARM,
  WATER,
  WOOD,
} from '../palette.ts';
import type { Sprite } from '../sprite.ts';
import { castShadow, groundShadow } from '../view.ts';

const CELLS = 16;

const SUN: readonly Light[] = [{ kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 }];

const LEGEND: Record<string, Rgba> = {
  '.': CLEAR,
  K: INK,
  '1': STONE[1]!,
  '2': STONE[2]!,
  '3': STONE[3]!,
  '4': STONE[4]!,
  '5': STONE[5]!,
  '6': STONE[6]!,
  x: EARTH[0]!,
  e: EARTH[1]!,
  u: EARTH[2]!,
  E: EARTH[3]!,
  Y: EARTH[4]!,
  w: WOOD[0]!,
  v: WOOD[1]!,
  W: WOOD[2]!,
  o: WOOD[3]!,
  b: WATER[2]!,
  j: WATER[3]!,
  B: WATER[5]!,
  l: WATER[7]!,
  f: FIRE[2]!,
  F: FIRE[5]!,
  n: FOLIAGE[0]!,
  g: FOLIAGE[1]!,
  a: FOLIAGE[2]!,
  G: FOLIAGE[3]!,
  k: CLOTH[1]!,
  c: CLOTH[2]!,
  y: CLOTH[3]!,
  C: CLOTH[4]!,
  r: STONE_WARM[2]!,
  m: STONE_WARM[3]!,
  p: STONE_WARM[4]!,
  A: STONE_WARM[5]!,
  M: STONE_WARM[6]!,
  '0': CHAR[0]!,
  h: CHAR[1]!,
  H: CHAR[3]!,
  R: RED,
  Q: EMBER[0]!,
};

interface Part {
  x?: number;
  y?: number;
  rows: readonly string[];
  shadow?: readonly [number, number, number];
}

interface Mini {
  id: string;
  foot: number;
  parts: readonly Part[];
}

function paint(grid: Grid, part: Part, name: string): void {
  for (const [row, line] of part.rows.entries()) {
    for (const [column, char] of [...line].entries()) {
      const color = LEGEND[char];
      if (color === undefined) throw new Error(`${name}: no colour for "${char}"`);
      if (color !== CLEAR) put(grid, (part.x ?? 0) + column, (part.y ?? 0) + row, color);
    }
  }
}

function drawMini(mini: Mini): Grid {
  const grid = createGrid(CELLS);
  for (const part of mini.parts) paint(grid, part, mini.id);
  for (const [index, part] of mini.parts.entries()) {
    if (!part.shadow) continue;
    const [footX, footY, width] = part.shadow;
    castShadow(grid, groundShadow(footX, footY, width, 401 + index * 13, 0.3), SHADOW);
  }
  return grid;
}

const MINIS: readonly Mini[] = [
  {
    id: 'cord-walk',
    foot: 12,
    parts: [
      {
        rows: [
          '................',
          '................',
          '................',
          '.KKK........KKK.',
          '.KoK........KoK.',
          '.KoMAAAAAAAAMoK.',
          '.KWKmm....mmKWK.',
          '.KWK..mmmm..KWK.',
          '.KWK........KWK.',
          '.KvK........KWK.',
          '.KvK........KvK.',
          '.KKK........KvK.',
          '............KKK.',
        ],
        shadow: [3, 11, 3],
      },
      { x: 12, y: 0, rows: [], shadow: [14, 12, 3] },
      {
        x: 4,
        y: 10,
        rows: [
          '.KKKKKKK.',
          'KMAAAAAmK',
          'KAKK00KrK',
          '.KmmmmrK.',
          '..KKKKK..',
        ],
        shadow: [8.5, 14, 9],
      },
    ],
  },
  {
    id: 'weaving-frame',
    foot: 13,
    parts: [
      {
        rows: [
          '................',
          'KKKKKKKKKKKK....',
          'KooooooooooK....',
          'KKKKKKKKKKKK....',
          'KoKo.o.o.KWK....',
          'KoKo.o.o.KWK....',
          'KoKo.o.o.KWK....',
          'KoKAMAMAMKWK....',
          'KoKmAmAmAKWK....',
          'KvKAMAMAMKvK....',
          'KvKKKKKKKKvK....',
          'KKK......KKK....',
        ],
        shadow: [6, 11, 12],
      },
      {
        x: 8,
        y: 6,
        rows: [
          '.K.K.K.',
          '.o.o.o.',
          'KoKoKoK',
          'KMAMAmK',
          'KAMAmrK',
          'KMAMAmK',
          '.KmrmK.',
          '..KKK..',
        ],
        shadow: [11.5, 13, 7],
      },
    ],
  },
  {
    id: 'daub-pit',
    foot: 4,
    parts: [
      {
        rows: [
          '................',
          '................',
          '................',
          '................',
          '....xxxxxxx.....',
          '..xxeeeeeeexx...',
          '.xeehhhhhhheeu..',
          '.xehuuuMuuuueE..',
          '.xhuuAuuuuMuuE..',
          '..huuuuMAuuuuE..',
          '..euuMuuuuAuE...',
          '...YuuuuuuuuY...',
          '....YYYYYYYY....',
          '................',
          '................',
          '................',
        ],
      },
    ],
  },
  {
    id: 'pit-firing',
    foot: 13,
    parts: [
      {
        rows: [
          '................',
          '................',
          '................',
          '.....KKKK.......',
          '....KMAAmK......',
          '....KA00rK......',
          '...KKMApmKKKK...',
          '.KGaKApmrKMAmK..',
          '.KaGaKKKKaKm0KK.',
          'KEaGagagaGagnguK',
          'KEYEuEuEuEuuEueK',
          'KYEuEuuEuEuueuxK',
          '.KEuuuEuuuuuuxK.',
          '..KKKKKKKKKKKK..',
        ],
        shadow: [8, 13, 14],
      },
      { x: 4, y: 12, rows: ['f'] },
      { x: 9, y: 12, rows: ['F'] },
      { x: 12, y: 11, rows: ['f'] },
    ],
  },
  {
    id: 'charcoal-clamp',
    foot: 14,
    parts: [
      {
        rows: [
          '................',
          '................',
          '................',
          '......KKKK......',
          '.....KY0hEK.....',
          '.....KEYEuK.....',
          '....KYEEuueK....',
          '....KEYEuuuK....',
          '...KYEEuEuueK...',
          '...KEYEuuuueK...',
          '..KYEEuEuuuexK..',
          '..KEYEuuEuuexK..',
          '.KYEEuuuuEuuexK.',
          '.K0fEu0fuuE0fxK.',
          '..KKKKKKKKKKKK..',
        ],
        shadow: [8, 14, 13],
      },
      { x: 7, y: 4, rows: ['f'] },
    ],
  },
  {
    id: 'lean-to',
    foot: 12,
    parts: [
      {
        rows: [
          '.KK.............',
          'KwwKKKK.........',
          'KMAMAMAKKK......',
          'KAMAMAMAMAKK....',
          'KwMAMAMAMApmKK..',
          'KKwwwMAMAMApmrK.',
          'KoK0hwwwAMApmrK.',
          'KoK00hhhwwApmrK.',
          'KoK000hhhhwmprK.',
          'KWK000hhhhhwmrK.',
          'KWK00000hhhhwmK.',
          'KvKEEuEEuuEuuwK.',
          'KKKKKKKKKKKKKKK.',
        ],
        shadow: [8, 12, 14],
      },
    ],
  },
  {
    id: 'well',
    foot: 12,
    parts: [
      {
        rows: [
          '................',
          '................',
          '................',
          '....KKKKKKKK....',
          '..KK66565554KK..',
          '.K665KKKKKK443K.',
          '.K65KbjjBjjbK3K.',
          '.K54KbjBlBjbK3K.',
          '.K54KbbjjjbbK2K.',
          '.K5543KKKK3322K.',
          '.K3K44K33K32K2K.',
          '.K43K34K23K22K..',
          '..KKKKKKKKKKK...',
        ],
        shadow: [8, 12, 14],
      },
    ],
  },
  {
    id: 'bank-dig',
    foot: 12,
    parts: [
      {
        rows: [
          '................',
          '................',
          '................',
          '................',
          '................',
          '..xxxxxx........',
          '.xxeeeeexx......',
          'xeehhhhheex.....',
          'xehbbjjbbuE.....',
          '.ehbjBjjbuE.....',
          '..YuubbuuEY.....',
          '...YYYYYYY......',
        ],
      },
      {
        x: 8,
        y: 6,
        rows: [
          '...KKK..',
          '..KYEuK.',
          '.KYEuuuK',
          'KYEEuueK',
          'KEEuuuexK',
          '.KKKKKKK.',
        ],
        shadow: [12, 11, 8],
      },
    ],
  },
  {
    id: 'clay-pit',
    foot: 13,
    parts: [
      {
        rows: [
          '................',
          '................',
          '................',
          '................',
          '..eexxxxee......',
          '.e1122222u1.....',
          'e112333332E.....',
          'e123344433E.....',
          '.2334bj43E......',
          '..Y334443Y......',
          '...YYYYYY.......',
        ],
      },
      {
        x: 9,
        y: 6,
        rows: [
          '.KKKKK.',
          'K66665K',
          'K44432K',
          'KKKKKKK',
          'K66665K',
          'K44432K',
          'K33321K',
          '.KKKKK.',
        ],
        shadow: [12.5, 13, 7],
      },
    ],
  },
  {
    id: 'reed-bed',
    foot: 11,
    parts: [
      {
        rows: [
          '................',
          '...K.....K......',
          '..KwK...KwK.....',
          '..KvK.K.KvK.....',
          '...n.GaK.n..K...',
          '..GnGan.GnGKwK..',
          '..GnGan.Gn.KvK..',
          '.GnGanGnGnGan...',
          '.GnanGnGanGnaG..',
          'GanGnaGnGanGanG.',
          'nGanGnGanGnGnGn.',
          'ubbnjbnbbnjbnbu.',
          '.ubbjjbBbjjbbu..',
          '..uubbbbbbbuu...',
        ],
        shadow: [10, 12, 12],
      },
    ],
  },
  {
    id: 'fibre-patch',
    foot: 12,
    parts: [
      {
        y: 9,
        rows: [
          '.G........G.....',
          'GaG..G...gaG..G.',
          'gag.GaG..gag.GaG',
          '.n..gag...n..gag',
          '.....n........n.',
        ],
      },
      {
        x: 4,
        y: 1,
        rows: [
          'a.G..a.a.',
          'KaKaGKgK.',
          'KagaAaGK.',
          '.KAaMagK.',
          '..KApmK..',
          '..KwwK...',
          '..KApK...',
          '.KMApmK..',
          'KMAMApmK.',
          'KAMApmrK.',
          '.KKKKKK..',
        ],
        shadow: [7.5, 11, 7],
      },
    ],
  },
  {
    id: 'forage-camp',
    foot: 13,
    parts: [
      {
        x: 0,
        y: 5,
        rows: [
          '..KKKK..',
          '.KooWoK.',
          '.KoWvoK.',
          'KKKooKKK',
          'KooWKKooK',
          'KoWvoKoWvK',
          'KooWoKooWK',
          '.KKKK.KKK.',
        ],
        shadow: [5, 12, 9],
      },
      {
        x: 8,
        y: 5,
        rows: [
          '..o..v..',
          '..o.v.o.',
          '.KRQoRKo',
          'KRQRvRQK',
          'KMAMAMmK',
          'KAMAMmrK',
          '.KAMmrK.',
          '..KKKK..',
        ],
        shadow: [12, 13, 7],
      },
    ],
  },
  {
    id: 'digging',
    foot: 12,
    parts: [
      {
        rows: [
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '.xxxxxx.........',
          'xxeeeeexx.......',
          'xehhhhhheE......',
          'xh0000hhuE......',
          '.huuhuuuE.......',
          '..YuuuuEY.......',
          '...YYYYY........',
        ],
      },
      {
        x: 7,
        y: 6,
        rows: [
          '...KKK...',
          '..KYEuK..',
          '.KYEuuuK.',
          'KYEEuuueK',
          'KEEuuuexK',
          '.KKKKKKK.',
        ],
        shadow: [11.5, 11, 9],
      },
      {
        x: 11,
        y: 0,
        rows: [
          '...KK',
          '..KoK',
          '..Ko.',
          '.KoK.',
          '.Ko..',
          'K5K..',
          'K3K..',
        ],
      },
    ],
  },
  {
    id: 'woodcutter',
    foot: 13,
    parts: [
      {
        x: 1,
        y: 4,
        rows: [
          '.KKKK.',
          'KoooWK',
          'KoWvoK',
          'KWooWK',
          'KvwvwK',
          'KwvwvK',
          'KvwwvK',
          '.KKKK.',
        ],
        shadow: [4, 11, 6],
      },
      {
        x: 3,
        y: 1,
        rows: [
          '....K',
          '...Ko',
          '..KoK',
          'K5oK.',
          'K3K..',
        ],
      },
      {
        x: 6,
        y: 8,
        rows: [
          '..KKKKKKK.',
          '.KooKvwvwK',
          '.KoWKwvwvK',
          'KKKKKKKKK.',
          'KooKvwvwvK',
          'KoWKwvwvwK',
          '.KKKKKKKK.',
        ],
        shadow: [11.5, 14, 10],
      },
    ],
  },
  {
    id: 'slot',
    foot: 0,
    parts: [
      {
        rows: [
          '................',
          '................',
          '................',
          '................',
          '.....E.E.E......',
          '...E.EEEEEEE.E..',
          '..E.EEEEEEEEE...',
          '.E.EEEEEEEEEEEE.',
          '..EEEEEEEEEEEE..',
          '.E.EEEEEEEEEE.E.',
          '...E.EEEEEEE.E..',
          '.....E.E.E......',
          '................',
        ],
      },
      { x: 3, y: 6, rows: ['o', 'w', 'u'] },
      { x: 12, y: 9, rows: ['o', 'w', 'u'] },
    ],
  },
];

const sprite = (mini: Mini): Sprite => {
  const drawn = drawMini(mini);
  return {
    name: `mini-${mini.id}`,
    cells: CELLS,
    lights: SUN,
    clips: [{ name: 'default', frames: 1 }],
    pieces: [{ clip: 'default', foot: mini.foot }],
    draw: () => ({ size: drawn.size, cells: drawn.cells.slice() }),
  };
};

export const MINI_SPRITES: readonly Sprite[] = MINIS.map(sprite);
