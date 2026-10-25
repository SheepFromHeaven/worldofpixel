
export const GLYPH = { w: 5, h: 7 } as const;
export const BOX = { w: 6, h: 9 } as const;

export const FONT_COLS = 16;
export const FIRST_CODE = 32;
export const LAST_CODE = 126;

const FOLDED: Record<string, string> = {
  '\u2192': '->',
  '\u2190': '<-',
  '\u00b7': '-',
  '\u2013': '-',
  '\u2014': '-',
  '\u00d7': 'x',
  '\u2026': '...',
  '\u2018': "'",
  '\u2019': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u221e': '8',
};

export function foldToFont(text: string): string {
  let out = '';
  for (const character of text) {
    const code = character.codePointAt(0) ?? 32;
    if (code >= FIRST_CODE && code <= LAST_CODE) {
      out += character;
      continue;
    }
    out += FOLDED[character] ?? '?';
  }
  return out;
}

export const TEXT_SCALE = 2;
export const HEAD_SCALE = 3;

export const MARK_SCALE = 1;
export const FONT_SCALES: readonly number[] = [MARK_SCALE, TEXT_SCALE, HEAD_SCALE];

export const SHEET_VERSION = 14;

export const ICON_CELLS = 16;
export const ICON_COLS = 6;
export const ICON_SCALE = 2;

export const ICON_NAMES = [
  'inspect',
  'found',
  'road',
  'raze',
  'pencil',
  'design',

  'well',
  'dig',
  'woodcutter',
  'mixer',
  'land',
  'workshops',

  'water',
  'dirt',
  'mud',
  'wood',
  'deadwood',
  'crate',
  'next',

  'source',
  'input',
  'output',
  'combine',
  'transport',
  'storage',

  'arrow-n',
  'arrow-ne',
  'arrow-e',
  'arrow-se',
  'arrow-s',
  'arrow-sw',
  'arrow-w',
  'arrow-nw',

  'hearth',
  'play',
  'pause',
  'step',
  'dice',

  'fire-low',
  'fire-mid',
  'fire-high',
  'embers',
  'vessel',

  'clay',
  'pot',
  'charcoal',
  'brands',
  'pit-fire',
  'clamp',

  'fibre',
  'cord',
  'basket',
  'daub',
  'cord-walk',
  'weaving-frame',
  'berries',
  'stone',
  'forage',

  'strike',

  'fast',
  'faster',

  'coin-fire',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export function itemIcon(item: string): IconName {
  const name = item.toLowerCase();
  return (ICON_NAMES as readonly string[]).includes(name) ? (name as IconName) : 'crate';
}

export const PLATE_CELLS = 12;
export const PLATE_SLICE = 4;
export const PLATE_SCALE = 3;

export const PLATE_NAMES = [
  'board',
  'slab',
  'sheet',
  'tile',
  'tile-hover',
  'tile-on',
  'tile-off',
  'field',
  'slot',
  'ring-slab',
  'ring-sheet',
  'ring-board',
] as const;

export type PlateName = (typeof PLATE_NAMES)[number];

export const SURFACE_CELLS = 32;

export const SURFACE_NAMES = ['sandstone', 'parchment', 'slate'] as const;

export type SurfaceName = (typeof SURFACE_NAMES)[number];
