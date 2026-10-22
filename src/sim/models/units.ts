
export function clamp(value: number, low = 0, high = 1): number {
  return value < low ? low : value > high ? high : value;
}

export const round2 = (value: number): number => Math.round(value * 100) / 100;
