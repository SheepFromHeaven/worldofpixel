export const CLOSE_UP_SCALE = 11;

export const FLOOR_PIXELS = CLOSE_UP_SCALE * 16;

export const HAND_SIZE = 144;

export const HAND_TILT = -0.28;

export const WRIST_RADIUS = 15;

export interface Point {
  x: number;
  y: number;
}

export interface Digit {
  joints: readonly Point[];
  radii: readonly number[];
  nail: boolean;
  finger: boolean;
}

export interface HandShape {
  wrist: Point;
  palm: readonly Point[];
  digits: readonly Digit[];
  knuckles: readonly Point[];
  tip: Point;
  hold: Point;
}

interface FingerPlan {
  across: number;
  base: number;
  lengths: readonly [number, number, number];
  radius: number;
  spread: number;
}

const FINGERS: readonly FingerPlan[] = [
  { across: -15.5, base: 47, lengths: [21, 13, 10], radius: 5.6, spread: -0.12 },
  { across: -5, base: 50, lengths: [23, 15, 11], radius: 5.9, spread: -0.03 },
  { across: 5.5, base: 48, lengths: [21, 14, 10], radius: 5.6, spread: 0.06 },
  { across: 15, base: 42, lengths: [17, 10, 9], radius: 4.8, spread: 0.16 },
];

const PALM_OUTLINE: readonly (readonly [number, number])[] = [
  [-2, -14],
  [-2, 14],
  [24, 19],
  [41, 19.5],
  [48, 11],
  [50, -1],
  [47, -12],
  [36, -21],
  [16, -20],
];

const PALM_TOP = { along: 40, across: -2 };

const HOLD = { along: 47, across: -4 };

const CURLED = [0.6, 0.45, 0] as const;

export function handShape(grip: boolean): HandShape {
  const wrist = { x: HAND_SIZE / 2 + 20, y: HAND_SIZE - 12 };
  const axis = { x: Math.sin(HAND_TILT), y: -Math.cos(HAND_TILT) };
  const side = { x: -axis.y, y: axis.x };
  const place = (along: number, across: number): Point => ({
    x: wrist.x + axis.x * along + side.x * across,
    y: wrist.y + axis.y * along + side.y * across,
  });

  const knuckles: Point[] = [];
  const digits: Digit[] = FINGERS.map((finger) => {
    const start = place(finger.base - 6, finger.across);
    knuckles.push(place(finger.base - 2, finger.across));
    const joints: Point[] = [start];
    let along = finger.base - 6;
    let across = finger.across;
    finger.lengths.forEach((length, segment) => {
      const reach = grip ? length * CURLED[segment]! : length + (segment === 0 ? 6 : 0);
      if (reach <= 0) return;
      const turn = finger.spread * (grip ? 0.3 : 1 + segment * 0.2);
      along += Math.cos(turn) * reach;
      across += Math.sin(turn) * reach;
      joints.push(place(along, across));
    });
    const radii = [finger.radius, finger.radius * 0.93, finger.radius * 0.86, finger.radius * 0.8].map((radius) => (grip ? radius * 1.12 : radius));
    return { joints, radii, nail: !grip, finger: true };
  });

  const thumb: Digit = { joints: [place(8, -15), place(24, -27), place(36, -37), place(44, -43)], radii: [9, 7, 6, 5.2], nail: true, finger: false };

  const tuck: Digit = { joints: [place(10, -15), place(22, -25), place(29, -28)], radii: [9, 7.6, 6.6], nail: false, finger: false };

  return {
    wrist,
    palm: PALM_OUTLINE.map(([along, across]) => place(along, across)),
    digits: grip ? [tuck, ...digits] : [thumb, ...digits],
    knuckles,
    tip: place(PALM_TOP.along, PALM_TOP.across),
    hold: place(HOLD.along, HOLD.across),
  };
}
