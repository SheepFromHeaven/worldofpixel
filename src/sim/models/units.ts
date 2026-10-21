/**
 * The arithmetic the models share.
 *
 * `round2` is not tidiness: every number these models hand out is compared against the figures
 * in `docs/methods.html`, which round the same way, and a model that kept full precision would
 * drift from the document it is the implementation of.
 */

export function clamp(value: number, low = 0, high = 1): number {
  return value < low ? low : value > high ? high : value;
}

export const round2 = (value: number): number => Math.round(value * 100) / 100;
