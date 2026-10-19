/**
 * Where the baked UI sheets put things, and how big they come out.
 *
 * The one module under `src/pixel/` the game itself imports. Everything else here is authoring
 * and stays out of the bundle, but a sheet is useless without the arithmetic that finds a glyph
 * in it, and two copies of that arithmetic drift the moment a box changes size — silently, into
 * every label on screen showing the letter next door.
 *
 * Nothing in here reaches the engine: it is numbers, and it tree-shakes to numbers.
 */

/** A glyph's inked box. The 5x7 is the drawing; the box carries a column and two rows of air. */
export const GLYPH = { w: 5, h: 7 } as const;
export const BOX = { w: 6, h: 9 } as const;

/** Where the baseline sits in the box, so a descender has somewhere to go. */
export const BASELINE = 6;

export const FONT_COLS = 16;
export const FIRST_CODE = 32;
export const LAST_CODE = 126;

/**
 * The scales the font is baked at, and nothing between them.
 *
 * A sheet is drawn at its final size and never resampled, so a glyph is crisp without relying on
 * `image-rendering` — which a mask does not always honour, and the labels are masks so they can
 * take their colour from the button under them.
 */
export const TEXT_SCALE = 2;
export const HEAD_SCALE = 3;
export const FONT_SCALES: readonly number[] = [TEXT_SCALE, HEAD_SCALE];

export const ICON_CELLS = 16;
export const ICON_COLS = 4;
export const ICON_SCALE = 2;

/** Declaration order is the sheet's order, left to right and then down. */
export const ICON_NAMES = [
  'inspect',
  'found',
  'road',
  'raze',
  'pencil',
  'design',
  'well',
  'dig',
  'mixer',
  'play',
  'pause',
  'step',
  'dice',
  'next',
  'crate',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** A plate is a nine-slice: three cells of corner, three of stretched edge, three of corner. */
export const PLATE_CELLS = 9;
export const PLATE_SLICE = 3;
export const PLATE_SCALE = 3;

export const PLATE_NAMES = ['panel', 'button', 'button-hover', 'button-on', 'field'] as const;

export type PlateName = (typeof PLATE_NAMES)[number];
