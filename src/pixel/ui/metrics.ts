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
 * What a character outside the font is drawn as.
 *
 * The sheet is printable ASCII and stops there, which is the right size for a 5x7 — but the
 * game's own prose is written with the marks a typesetter would use, and `1 Water + 1 Dirt →
 * 1 Mud` coming out as `1 Water + 1 Dirt ? 1 Mud` reads as a bug in the recipe rather than a
 * gap in the font. Folding happens at the glyph, not at the string, so the sim and the renderer
 * go on writing what they mean and nothing has to know which characters have been drawn.
 *
 * Only marks with an honest ASCII equivalent are here. Anything else still comes out as `?`,
 * which is the truth: that character has not been drawn.
 */
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

/** A string with every character the font has no drawing for folded onto one that it has. */
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

/**
 * The scales the font is baked at, and nothing between them.
 *
 * A sheet is drawn at its final size and never resampled, so a glyph is crisp without relying on
 * `image-rendering` — which a mask does not always honour, and the labels are masks so they can
 * take their colour from the button under them.
 */
export const TEXT_SCALE = 2;
export const HEAD_SCALE = 3;

/**
 * The map's own size, and the reason the ladder starts at one.
 *
 * The HUD is laid over the window and reads at its sizes; a town's name is laid on the map,
 * where a glyph cell has to be a buffer pixel and nothing else — the same pixel the ground and
 * every tile standing on it are drawn from. At the HUD's smallest a name was twice the height
 * of the mark it belonged to and read as a caption pasted over the country.
 */
export const MARK_SCALE = 1;
export const FONT_SCALES: readonly number[] = [MARK_SCALE, TEXT_SCALE, HEAD_SCALE];

/**
 * Bumped whenever the sheets in `public/ui` are baked again.
 *
 * They are plain files under `public/`, so nothing hashes their names and a browser holds on to
 * the one it has. A sheet whose *contents* moved — an icon added, so every slot after it shifted
 * — then draws the right slot of the wrong picture, which is not a blank where the new icon
 * should be but somebody else's drawing in its place. That is a great deal harder to recognise
 * than a missing image.
 */
export const SHEET_VERSION = 6;

export const ICON_CELLS = 16;
export const ICON_COLS = 6;
export const ICON_SCALE = 2;

/**
 * Declaration order is the sheet's order, left to right and then down.
 *
 * Five runs, and the grouping is load-bearing: a drawing moved between them is a drawing that
 * means something else. The hand tools, then the things that come out of the ground, then the
 * blocks a machine is built from, then the eight ways a load can be going, then the clock. The
 * last is on its own because it is not a thing at all: `strike` is a mark laid *on* the map.
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

  'strike',
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

/**
 * The face behind a plate, as a square that repeats.
 *
 * A nine-slice stretches its middle, so a grain drawn into a plate comes out as a streak the
 * length of the panel — the face has to tile behind the rail instead. Thirty-two cells because
 * the repeat has to clear the width of a panel: at twelve the same pit turns up three times in a
 * line and reads as a pattern rather than as stone.
 */
export const SURFACE_CELLS = 32;

export const SURFACE_NAMES = ['sandstone', 'parchment', 'slate'] as const;

export type SurfaceName = (typeof SURFACE_NAMES)[number];
