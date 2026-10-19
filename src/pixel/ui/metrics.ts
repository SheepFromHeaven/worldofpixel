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
export const ICON_COLS = 6;
export const ICON_SCALE = 2;

/**
 * Declaration order is the sheet's order, left to right and then down.
 *
 * Four runs, and the grouping is load-bearing: a drawing moved between them is a drawing that
 * means something else. The hand tools, then the things that come out of the ground, then the
 * blocks a machine is built from, then the clock.
 */
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
  'crate',
  'next',

  'source',
  'input',
  'output',
  'combine',
  'transport',
  'storage',

  'hearth',
  'play',
  'pause',
  'step',
  'dice',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/**
 * The drawing for an item, found by its name.
 *
 * By name rather than through a `Record<ItemType, IconName>`, because the two lists grow at
 * different ends: the simulation adds an item, and the drawing for it is made here. A record
 * would not compile until both had happened, which puts the pressure in the wrong place — the
 * sim should be free to carry something before anyone has settled what it looks like. An item
 * nobody has drawn yet travels as a crate, which is true of it.
 */
export function itemIcon(item: string): IconName {
  const name = item.toLowerCase();
  return (ICON_NAMES as readonly string[]).includes(name) ? (name as IconName) : 'crate';
}

/**
 * A plate is a nine-slice: four cells of corner, four of stretched edge, four of corner.
 *
 * Four rather than three because a mahjong tile's bevel is four cells deep — see `plates.ts`.
 * The CSS border width has to follow `PLATE_BORDER`, or a corner is resampled and the one thing
 * that makes the tile read as a solid goes soft.
 */
export const PLATE_CELLS = 12;
export const PLATE_SLICE = 4;
export const PLATE_SCALE = 3;

/** The border width a plate is drawn with, in CSS pixels. The slice, at the scale it is baked. */
export const PLATE_BORDER = PLATE_SLICE * PLATE_SCALE;

export const PLATE_NAMES = ['board', 'tile', 'tile-hover', 'tile-on', 'field', 'slot'] as const;

export type PlateName = (typeof PLATE_NAMES)[number];
