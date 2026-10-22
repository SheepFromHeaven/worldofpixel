export type Rgba = number;

export const CLEAR: Rgba = 0x00000000;

export const rgba = (hex: number, alpha = 0xff): Rgba => (((hex << 8) | alpha) >>> 0);

export const alphaOf = (color: Rgba): number => color & 0xff;

export type Ramp = readonly Rgba[];

export function rampAt(ramp: Ramp, shade: number): Rgba {
  const index = Math.round(Math.min(1, Math.max(0, shade)) * (ramp.length - 1));
  return ramp[index] ?? ramp[ramp.length - 1] ?? CLEAR;
}
