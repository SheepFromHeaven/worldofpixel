export const clampBetween = (value: number, lowest = 0, highest = 1): number =>
  Math.min(highest, Math.max(lowest, value));

export const smoothstepBetween = (edgeStart: number, edgeEnd: number, value: number): number => {
  const progress = clampBetween((value - edgeStart) / (edgeEnd - edgeStart));
  return progress * progress * (3 - 2 * progress);
};

export function hashThreeIntegers(first: number, second: number, third: number): number {
  let mixed =
    Math.imul(first | 0, 0x27d4eb2d) ^ Math.imul(second | 0, 0x165667b1) ^ Math.imul(third | 0, 0x9e3779b9);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x2c1b3c6d);
  mixed ^= mixed >>> 12;
  mixed = Math.imul(mixed, 0x297a2d39);
  return ((mixed ^ (mixed >>> 15)) >>> 0) / 4294967296;
}

export function smoothValueNoise(x: number, y: number, salt: number): number {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const fractionX = x - cellX;
  const fractionY = y - cellY;
  const easedX = fractionX * fractionX * (3 - 2 * fractionX);
  const easedY = fractionY * fractionY * (3 - 2 * fractionY);
  const topLeft = hashThreeIntegers(cellX, cellY, salt);
  const topRight = hashThreeIntegers(cellX + 1, cellY, salt);
  const bottomLeft = hashThreeIntegers(cellX, cellY + 1, salt);
  const bottomRight = hashThreeIntegers(cellX + 1, cellY + 1, salt);
  return (
    topLeft +
    (topRight - topLeft) * easedX +
    (bottomLeft - topLeft) * easedY +
    (topLeft - topRight - bottomLeft + bottomRight) * easedX * easedY
  );
}
