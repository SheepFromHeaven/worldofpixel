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

/**
 * The shadow a tile casts on the ground: ink, a third opaque. Translucent because a tile is baked
 * without knowing what it will stand on — a ground decal has the ground's own ramp to darken and
 * uses that instead (`ground/decals.ts`), and the two have to come out the same weight.
 */
export const SHADOW = rgba(0x2b2519, 0x55);

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
 * Pine and spruce: darker and bluer than broadleaf, which is how a stand of conifers is told
 * from a stand of oaks at a glance — by colour long before anyone can make out a needle.
 */
export const NEEDLE: Ramp = [
  rgba(0x1b3125),
  rgba(0x22402f),
  rgba(0x2c523a),
  rgba(0x3a6648),
  rgba(0x4f7d5b),
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

/**
 * The red pencil, given a ramp so a pressed tile can be bevelled in it.
 *
 * A chosen tile is still a tile: it has a lit edge and a shaded one, and those have to be red or
 * the shape falls apart the moment the face changes colour. `EMBER[2]` is `RED` itself, so the
 * HUD's one accent is the same colour whether it is a line or a face.
 */
export const EMBER: Ramp = [
  rgba(0x5e241b),
  rgba(0x8a3528),
  RED,
  rgba(0xd4796a),
  rgba(0xe8a398),
];

/**
 * Bone. What a mahjong tile's face is made of, and the one material in the HUD that is a thing
 * rather than a surface: the build menu is tiles laid on a board, so a button has a lit top edge
 * and a shaded bottom one cut from this, and the shape comes out of the ramp rather than out of
 * a border colour someone picked.
 *
 * Longer than the parchment ramp it replaces, because a bevel is the whole of the drawing here —
 * the face, the lit edge and the shaded one are three steps that have to read apart at a glance.
 */
export const BONE: Ramp = [
  rgba(0x6a6049),
  rgba(0x8c8165),
  rgba(0xb0a484),
  rgba(0xcdc2a0),
  rgba(0xe3dabb),
  rgba(0xf1ebd6),
  rgba(0xfdf9ec),
];

/** The board the tiles are laid on: cloth, not paper. */
export const FELT: Ramp = [
  rgba(0x16281d),
  rgba(0x1f3a2a),
  rgba(0x2a4e37),
  rgba(0x366045),
  rgba(0x437355),
];

/** The rail round the board. Darker and redder than cut timber — oiled, and years of it. */
export const BOARD: Ramp = [
  rgba(0x2a1a10),
  rgba(0x3f2817),
  rgba(0x58381f),
  rgba(0x724a2a),
  rgba(0x8d6038),
];
