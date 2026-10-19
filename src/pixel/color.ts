/** A colour packed into one number as 0xRRGGBBAA, which is how a grid stores a cell. */
export type Rgba = number;

export const CLEAR: Rgba = 0x00000000;

export const rgba = (hex: number, alpha = 0xff): Rgba => (((hex << 8) | alpha) >>> 0);

export const alphaOf = (color: Rgba): number => color & 0xff;

/**
 * A material's colours, darkest first.
 *
 * Shading picks a step out of a ramp rather than mixing a new colour, which is the whole
 * discipline of pixel art: a lit face and a shaded face of the same stone have to be two colours
 * someone chose, not two samples of a gradient. Keep a ramp short — four to seven steps — or the
 * shading turns back into a gradient by another name.
 */
export type Ramp = readonly Rgba[];

/** The step of a ramp a shade between 0 and 1 lands on. */
export function rampAt(ramp: Ramp, shade: number): Rgba {
  const index = Math.round(Math.min(1, Math.max(0, shade)) * (ramp.length - 1));
  return ramp[index] ?? ramp[ramp.length - 1] ?? CLEAR;
}
