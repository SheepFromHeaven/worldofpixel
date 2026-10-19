import { rgba } from './color.ts';
import type { Ramp } from './color.ts';

/**
 * The ramps every sprite draws from, darkest step first.
 *
 * Shared on purpose. Two sprites that each invent their own stone are two kinds of stone on one
 * map, and the eye picks that up long before it works out why. These sit against the parchment
 * in `render/palette.ts` — chalky, a little desaturated — so the pixel tiles belong to the same
 * map as the pencil.
 */

export const INK = rgba(0x2b2519);

export const STONE: Ramp = [
  rgba(0x3d3529),
  rgba(0x4a4133),
  rgba(0x5a503e),
  rgba(0x7a6d55),
  rgba(0x8a7c61),
  rgba(0xa2937a),
  rgba(0xb5a684),
];

export const EARTH: Ramp = [
  rgba(0x40301d),
  rgba(0x4a3b27),
  rgba(0x6f5a3c),
  rgba(0x8a7250),
  rgba(0xa08a64),
];

export const WATER: Ramp = [
  rgba(0x0f3349),
  rgba(0x133f57),
  rgba(0x1b5c78),
  rgba(0x2a7593),
  rgba(0x3a8aa8),
  rgba(0x56b4c9),
  rgba(0x8fd4e4),
  rgba(0xbfeaf2),
];

/**
 * Stone with a fire on it. The same rock, chosen again under a different light: the darks go
 * red-brown rather than grey, and the lights go to the colour of hot sand.
 */
export const STONE_WARM: Ramp = [
  rgba(0x3a2a20),
  rgba(0x4e3526),
  rgba(0x6b462c),
  rgba(0x8d5e38),
  rgba(0xa87344),
  rgba(0xc28f55),
  rgba(0xd9ab6d),
];

/** Embers through to the pale heart of a flame. Longer than the others: fire is the one thing
 * on the map that has to carry a glow, and a glow needs steps to fall off through. */
export const FIRE: Ramp = [
  rgba(0x4a1a0c),
  rgba(0x7a2c10),
  rgba(0xa84418),
  rgba(0xc85f1c),
  rgba(0xe08a28),
  rgba(0xf0b23c),
  rgba(0xf8d864),
  rgba(0xfff0b4),
];

export const CHAR: Ramp = [
  rgba(0x1e1710),
  rgba(0x2e2318),
  rgba(0x453523),
  rgba(0x5c472f),
];

/** Soot with the fire still in it. */
export const CHAR_WARM: Ramp = [
  rgba(0x2a150c),
  rgba(0x4a2110),
  rgba(0x7a3a16),
  rgba(0xa85a24),
];

/**
 * People. Three ramps and no more: at sixteen cells a figure is a silhouette with two or three
 * colours in it, and every extra one costs a pixel that was carrying the shape.
 */
export const SKIN: Ramp = [
  rgba(0x4a2e1e),
  rgba(0x6b4530),
  rgba(0x8a5a3c),
  rgba(0xa8724c),
  rgba(0xc08a5e),
];

/** Undyed cloth and hide — what a people with no dye-works yet would be wearing. */
export const CLOTH: Ramp = [
  rgba(0x4a3e2c),
  rgba(0x6a5a42),
  rgba(0x857357),
  rgba(0x9d8a6b),
  rgba(0xb5a383),
];

export const HAIR: Ramp = [
  rgba(0x1b120c),
  rgba(0x2b1d13),
  rgba(0x3f2c1c),
  rgba(0x563d27),
];

/** Cut timber: a handle, a plank, a post. Warmer and lighter than the earth it stands in. */
export const WOOD: Ramp = [
  rgba(0x4a3221),
  rgba(0x6b4a2a),
  rgba(0x8a6238),
  rgba(0xa87c48),
];

export const FOLIAGE: Ramp = [
  rgba(0x2f5430),
  rgba(0x3c6b37),
  rgba(0x5f9340),
  rgba(0x8bbb55),
];

/**
 * The HUD's parchment, darkest step first, and the red pencil it marks with.
 *
 * These are the same values `render/palette.ts` names as CSS strings, written again as packed
 * colours because the UI plates are drawn by the pixel engine and the pencil map is drawn by the
 * canvas. One of the two has to be the copy; it is this one, and it must follow if those move —
 * a HUD a shade off the paper it sits on reads as a panel pasted onto the map.
 */
export const PAPER: Ramp = [
  rgba(0x6c6355),
  rgba(0xa69c8a),
  rgba(0xded5c0),
  rgba(0xece6d8),
  rgba(0xf4f1ea),
];

export const RED = rgba(0xc05140);
