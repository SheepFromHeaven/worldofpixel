const SIZE = 16;

const CENTRE = 7.5;

const REACH = 6.6;

type Tone = 'stone' | 'dark' | 'warm' | 'fire';

const TONES: Record<Tone, readonly [string, string, string]> = {
  stone: ['S', 's', 'd'],
  dark: ['s', 'd', 'd'],
  warm: ['M', 'A', 'm'],
  fire: ['F', 'f', 'R'],
};

function coin(glyph: readonly string[], tone: Tone): string[] {
  const [light, mid, shade] = TONES[tone];
  const rows: string[] = [];
  for (let y = 0; y < SIZE; y += 1) {
    let row = '';
    for (let x = 0; x < SIZE; x += 1) {
      const dx = x - CENTRE;
      const dy = y - CENTRE;
      const away = Math.hypot(dx, dy);
      const mark = glyph[y - 2]?.[x - 2];
      if (away > REACH + 0.5) row += '.';
      else if (away > REACH - 0.6) row += 'K';
      else if (mark !== undefined && mark !== '.') row += mark;
      else row += dx + dy < -3.2 ? light : dx + dy > 3.4 || away > REACH - 1.5 ? shade : mid;
    }
    rows.push(row);
  }
  return rows;
}

const FLINT = [
  '............',
  '.....KK.....',
  '....KKKK....',
  '...KKKKKK...',
  '...KK.KKK...',
  '..KKK..KKK..',
  '..KKKKKKKK..',
  '...KKKKKK...',
  '....KKKK....',
  '.....KK.....',
  '............',
  '............',
];

const STONE = [
  '............',
  '............',
  '....KKKK....',
  '...K....K...',
  '..K..KK..K..',
  '..K.K..K.K..',
  '..K..KK..K..',
  '..K......K..',
  '...K....K...',
  '....KKKK....',
  '............',
  '............',
];

const KINDLING = [
  '............',
  '..K....K....',
  '...K..K..K..',
  '....KKK.K...',
  '.....KK.K...',
  '....KKKK....',
  '...K.KK.K...',
  '..K..KK..K..',
  '.....KK.....',
  '.....KK.....',
  '............',
  '............',
];

const BRANCH = [
  '............',
  '.K.......K..',
  '.KK.....KK..',
  '..KK...KK...',
  '...KK.KK....',
  '....KKK.....',
  '.....KK.....',
  '.....KK.....',
  '.....KK.....',
  '.....KK.....',
  '............',
  '............',
];

const SPARK = [
  '............',
  '.....i......',
  '.....i......',
  '..i..F..i...',
  '...iFFFi....',
  '.iiFFiFFii..',
  '...iFFFi....',
  '..i..F..i...',
  '.....i......',
  '.....i......',
  '............',
  '............',
];

const DULL = [
  '............',
  '............',
  '............',
  '......f.....',
  '..f..fFf....',
  '....fFf..f..',
  '.....f..f...',
  '..f.........',
  '............',
  '............',
  '............',
  '............',
];

const EMBER = [
  '............',
  '............',
  '....KKKK....',
  '...KRRRRK...',
  '..KRQQQQRK..',
  '..KRQiiQRK..',
  '..KRQiiQRK..',
  '..KRQQQQRK..',
  '...KRRRRK...',
  '....KKKK....',
  '............',
  '............',
];

const SMOKE = [
  '............',
  '....SS......',
  '...S..S.....',
  '....S...S...',
  '.....S.S....',
  '....S..S....',
  '...S..S.....',
  '....SS......',
  '...S........',
  '..S.........',
  '............',
  '............',
];

const FLAME = [
  '.....F......',
  '.....FF.....',
  '....FFF.....',
  '....FiFF....',
  '...FFiiFF...',
  '...FiiiiF...',
  '..FFiiiiFF..',
  '..FFFiiFFF..',
  '..FFFFFFFF..',
  '...FFFFFF...',
  '....FFFF....',
  '............',
];

const SHARP = [
  '............',
  '.......K....',
  '......KSK...',
  '.....KSSSK..',
  '....KSSSK...',
  '...KSSSK....',
  '..KSSSK.....',
  '.KKKKK......',
  '............',
  '............',
  '............',
  '............',
];

const FIBRE = [
  '............',
  '..K.....K...',
  '...K...K....',
  '...K..K.....',
  '....KK..K...',
  '....K..K....',
  '...K..KK....',
  '...K...K....',
  '..K....K....',
  '..K.....K...',
  '............',
  '............',
];

const BINDING = [
  '............',
  '............',
  '............',
  '.KKKKKKKKKK.',
  'KKK.K.K.K.KK',
  '.KKKKKKKKKK.',
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
];

const TOOL = [
  '............',
  '....KK......',
  '...KSSK.....',
  '..KSSSSK....',
  '..KSSSSSK...',
  '...KSSSSSK..',
  '....KKKSK.K.',
  '.......KWWK.',
  '......KWK...',
  '.....KWK....',
  '....KWK.....',
  '............',
];

const BERRIES = [
  '............',
  '............',
  '...KKK......',
  '..KrrrK.KK..',
  '..KrrrKKrrK.',
  '...KKK.KrrK.',
  '.KK....KKK..',
  '.KrrK.......',
  '.KrrK.......',
  '..KK........',
  '............',
  '............',
];

const GRUBS = [
  '............',
  '............',
  '..KKKKKKK...',
  '.KhhhhhhhK..',
  '..KKKKKKK...',
  '............',
  '...KKKKKKK..',
  '..KhhhhhhhK.',
  '...KKKKKKK..',
  '............',
  '............',
  '............',
];

const EGG = [
  '............',
  '....KKK.....',
  '...KhhhK....',
  '..KhhhhhK...',
  '..KhhhhhK...',
  '..KhhhhhK...',
  '...KhhhK....',
  '....KKK.....',
  '............',
  '............',
  '............',
  '............',
];

const CORD = [
  '............',
  '..KK........',
  '.K..KK......',
  '.K....KK....',
  '..KK....K...',
  '....KK..K...',
  '......KK....',
  '....KK.KK...',
  '...K....K...',
  '....KKKK....',
  '............',
  '............',
];

const BASKET = [
  '............',
  '............',
  '...KKKKKK...',
  '..K......K..',
  '.KKKKKKKKKK.',
  '.KKKKKKKKKK.',
  '.K.K.K.K.KK.',
  '.KKKKKKKKKK.',
  '..K.K.K.KK..',
  '...KKKKKK...',
  '............',
  '............',
];

const COOKED = [
  '............',
  '....F...F...',
  '...F.F.F....',
  '..KKKKKKK...',
  '.KhhhhhhhK..',
  '.KhhhhhhhK..',
  '.KhhhhhhhK..',
  '..KKKKKKK...',
  '............',
  '............',
  '............',
  '............',
];

const FRAME = [
  '............',
  '.....KK.....',
  '....K..K....',
  '...K....K...',
  '..K..KK..K..',
  '..K.K..K.K..',
  '.K.K....K.K.',
  '.K........K.',
  'K..........K',
  '............',
  '............',
  '............',
];

const BED = [
  '............',
  '............',
  '............',
  '..KKKKKKKK..',
  '.KK.....KKK.',
  '.K.KKKKK.KK.',
  '.KKKKKKKKKK.',
  '..KKKKKKKK..',
  '..K......K..',
  '..K......K..',
  '............',
  '............',
];

const SHELTER = [
  '............',
  '........KK..',
  '......KK.K..',
  '....KK...K..',
  '..KK.....K..',
  '.KKKKKKKKK..',
  '.K.......K..',
  '.K.......K..',
  '.K.......K..',
  '............',
  '............',
  '............',
];

const HUT = [
  '............',
  '.....KK.....',
  '....KKKK....',
  '...KKKKKK...',
  '..KKKKKKKK..',
  '.KKKKKKKKKK.',
  '..K......K..',
  '..K..KK..K..',
  '..K..KK..K..',
  '..KKKKKKKK..',
  '............',
  '............',
];

const FISH = [
  '............',
  '............',
  '............',
  '....KKKK....',
  '.K.K....KK..',
  'KKK.......K.',
  'KKK....K..K.',
  '.K.K....KK..',
  '....KKKK....',
  '............',
  '............',
  '............',
];

const RABBIT = [
  '............',
  '...K..K.....',
  '..K.K.K.K...',
  '..K.K.K.K...',
  '..K.KKK.K...',
  '...KKKKK....',
  '..K..K..K...',
  '..KKKKKKK...',
  '...KKKKK....',
  '............',
  '............',
  '............',
];

const SPEAR = [
  '..........KK',
  '.........KKK',
  '........K.K.',
  '.......K....',
  '......K.....',
  '.....K......',
  '....K.......',
  '...K........',
  '..K.........',
  '.K..........',
  '............',
  '............',
];

const SNARE = [
  '............',
  '............',
  '....KKKK....',
  '...K....K...',
  '..K......K..',
  '..K......K..',
  '...K....K...',
  '....KKKK..K.',
  '...........K',
  '..........K.',
  '............',
  '............',
];

const QUERY = [
  '............',
  '....KKKK....',
  '...KK..KK...',
  '...KK..KK...',
  '......KK....',
  '.....KK.....',
  '.....KK.....',
  '............',
  '.....KK.....',
  '.....KK.....',
  '............',
  '............',
];

const SCAR = [
  '............',
  '..K......K..',
  '...K....K...',
  '....K..K....',
  '.....KK.....',
  '.....KK.....',
  '....K..K....',
  '...K....K...',
  '..K......K..',
  '............',
  '............',
  '............',
];

export const NEURON_ICONS: Record<string, string[]> = {
  'neuron-flint': coin(FLINT, 'stone'),
  'neuron-stone': coin(STONE, 'stone'),
  'neuron-kindling': coin(KINDLING, 'warm'),
  'neuron-branch': coin(BRANCH, 'warm'),
  'neuron-spark': coin(SPARK, 'dark'),
  'neuron-dull': coin(DULL, 'dark'),
  'neuron-ember': coin(EMBER, 'dark'),
  'neuron-smoke': coin(SMOKE, 'dark'),
  'neuron-flame': coin(FLAME, 'dark'),
  'neuron-sharp': coin(SHARP, 'stone'),
  'neuron-fibre': coin(FIBRE, 'warm'),
  'neuron-binding': coin(BINDING, 'warm'),
  'neuron-tool': coin(TOOL, 'stone'),
  'neuron-berries': coin(BERRIES, 'warm'),
  'neuron-grubs': coin(GRUBS, 'warm'),
  'neuron-egg': coin(EGG, 'stone'),
  'neuron-cord': coin(CORD, 'warm'),
  'neuron-basket': coin(BASKET, 'warm'),
  'neuron-cooked': coin(COOKED, 'dark'),
  'neuron-frame': coin(FRAME, 'warm'),
  'neuron-bed': coin(BED, 'warm'),
  'neuron-shelter': coin(SHELTER, 'warm'),
  'neuron-hut': coin(HUT, 'warm'),
  'neuron-fish': coin(FISH, 'stone'),
  'neuron-rabbit': coin(RABBIT, 'warm'),
  'neuron-spear': coin(SPEAR, 'stone'),
  'neuron-snare': coin(SNARE, 'warm'),
  'neuron-query': coin(QUERY, 'fire'),
  'neuron-scar': coin(SCAR, 'dark'),
};

export const BRAIN: readonly string[] = [
  '................',
  '....KKKKKKK.....',
  '..KKhhhHhhhKK...',
  '.KhhKhhHhKhhhK..',
  'KhhHhKhhhhKhHhK.',
  'KhhhhhKhHhhhhhK.',
  'KhHhKhhhKhhHhhK.',
  'KhhhhhHhhKhhhhK.',
  '.KhhHhhKhhhhhK..',
  '..KhhhhhhKKKK...',
  '...KKhhhKrrrK...',
  '.....KKKKrrrK...',
  '..........KrK...',
  '..........KrK...',
  '...........KK...',
  '................',
];
