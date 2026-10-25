import type { Ramp } from '../color.ts';
import { blob } from '../field.ts';
import type { Grid } from '../grid.ts';
import { createGrid, outline, put } from '../grid.ts';
import type { Light } from '../light.ts';
import { ASH, INK, NAIL, SKIN } from '../palette.ts';
import type { Material, Region } from '../shade.ts';
import { dome, shade } from '../shade.ts';
import type { Digit, HandShape, Point } from './closeUpMetrics.ts';
import { CLOSE_UP_SCALE, HAND_SIZE, handShape, WRIST_RADIUS } from './closeUpMetrics.ts';
import { CLOSE_UP_SOURCES } from './folk.ts';
import type { Standing } from './objects.ts';

const LIGHT: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

const surface = (ramp: Ramp, relief = 1.6): Material => ({ ramp, profile: dome, relief, ambient: 0.12, contrast: 0.85, speckle: 0.15, grit: 0.2 });

export interface CloseUpSprite {
  name: string;
  grid: Grid;
}

function enlarge(thing: Standing, scale: number): Region[] {
  return thing.regions.map((region) => ({
    mask: (x: number, y: number) => region.mask((x + 0.5) / scale - 0.5, (y + 0.5) / scale - 0.5),
    material: { ...region.material, speckle: (region.material.speckle ?? 0) * 0.35, grit: (region.material.grit ?? 0) * 0.5 },
  }));
}

function inked(size: number, regions: readonly Region[]): Grid {
  const grid = shade(size, regions, [LIGHT]);
  outline(grid, INK);
  return grid;
}

function ash(): Grid {
  const size = 16 * CLOSE_UP_SCALE;
  const middle = size / 2;
  const regions: Region[] = [0, 1, 2, 3, 4].map((i) => {
    const angle = i * 1.3;
    return {
      mask: blob(middle + Math.cos(angle) * 6 * (i % 3), middle + Math.sin(angle) * 5 * (i % 3), 9 - i, 7 - i * 0.6, 0.35, 300 + i),
      material: surface(ASH, 0.8),
    };
  });
  return inked(size, regions);
}

const LIGHT_DIRECTION = (() => {
  const raw = [-0.55, -0.72, 0.75];
  const length = Math.hypot(raw[0]!, raw[1]!, raw[2]!);
  return raw.map((value) => value / length) as [number, number, number];
})();

const BAYER_2 = [0, 0.5, 0.75, 0.25] as const;

const FLESH_ROUNDING = 6.5;

const WEB = 5;

const FAR = 1e6;

function polygonDistance(points: readonly Point[], x: number, y: number): number {
  let distance = Infinity;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i]!;
    const b = points[j]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const wx = x - a.x;
    const wy = y - a.y;
    const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)));
    distance = Math.min(distance, Math.hypot(wx - ex * t, wy - ey * t));
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside ? -distance : distance;
}

function segmentDistance(x: number, y: number, a: Point, b: Point, ra: number, rb: number): { d: number; t: number; across: number } {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const length = Math.hypot(ex, ey) || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (y - a.y) * ey) / (length * length)));
  const across = Math.hypot(x - (a.x + ex * t), y - (a.y + ey * t));
  return { d: across - (ra + (rb - ra) * t), t, across };
}

const smoothMin = (a: number, b: number, k: number): number => {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b * (1 - h) + a * h - k * h * (1 - h);
};

interface DigitSample {
  d: number;
  crease: boolean;
  nail: number;
}

interface HandSample {
  d: number;
  owner: DigitSample | null;
  overlapped: boolean;
}

function sampleDigit(digit: Digit, x: number, y: number): DigitSample {
  let d = FAR;
  let crease = false;
  let nail = 0;
  for (let segment = 0; segment + 1 < digit.joints.length; segment += 1) {
    const a = digit.joints[segment]!;
    const b = digit.joints[segment + 1]!;
    const ra = digit.radii[segment]!;
    const rb = digit.radii[segment + 1] ?? ra;
    const part = segmentDistance(x, y, a, b, ra, rb);
    d = smoothMin(d, part.d, 1.5);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (segment > 0 && part.t * length < 1 && part.d < -1.5) crease = true;
    if (segment + 2 === digit.joints.length && digit.nail) {
      const fromTip = (1 - part.t) * length;
      if (fromTip < rb * 1.9 && fromTip > rb * 0.2 && part.across < rb * 0.62) nail = fromTip < rb * 0.45 || part.across > rb * 0.48 ? 2 : 1;
    }
  }
  return { d, crease, nail };
}

function sampleHand(shape: HandShape, x: number, y: number): HandSample {
  const palm = polygonDistance(shape.palm, x, y) - 1.5;
  const sleeve = segmentDistance(x, y, shape.wrist, { x: shape.wrist.x + 8, y: shape.wrist.y + 30 }, WRIST_RADIUS, WRIST_RADIUS + 1);
  const digits = shape.digits.map((digit) => sampleDigit(digit, x, y));
  let fingers = FAR;
  for (const digit of digits) fingers = Math.min(fingers, digit.d);
  const owner = digits.find((digit) => digit.d < 0) ?? null;
  const overlapped = owner !== null && owner.d > -1.1 && digits.some((digit) => digit !== owner && digit.d < 0);
  return { d: smoothMin(smoothMin(palm, sleeve.d, 6), fingers, WEB), owner, overlapped };
}

function paintHand(grip: boolean): Grid {
  const shape = handShape(grip);
  const size = HAND_SIZE;
  const grid = createGrid(size);
  const samples: HandSample[] = [];
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sample = sampleHand(shape, x, y);
      samples.push(sample);
      const depth = Math.max(0, -sample.d);
      const rounded = Math.min(1, depth / FLESH_ROUNDING);
      let lift = FLESH_ROUNDING * Math.sqrt(1 - (1 - rounded) ** 2);
      for (const knuckle of shape.knuckles) lift += 1.5 * Math.exp(-((x - knuckle.x) ** 2 + (y - knuckle.y) ** 2) / 30);
      height[y * size + x] = sample.d < 0 ? lift : 0;
    }
  }

  const at = (x: number, y: number): number => height[Math.max(0, Math.min(size - 1, y)) * size + Math.max(0, Math.min(size - 1, x))]!;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sample = samples[y * size + x]!;
      if (sample.d > 0) continue;
      if (sample.d > -1.1) {
        put(grid, x, y, INK);
        continue;
      }
      if (sample.overlapped) {
        put(grid, x, y, SKIN[0]!);
        continue;
      }
      const gx = (at(x + 1, y) - at(x - 1, y)) / 2;
      const gy = (at(x, y + 1) - at(x, y - 1)) / 2;
      const length = Math.hypot(gx, gy, 1.4);
      const diffuse = (-gx * LIGHT_DIRECTION[0] - gy * LIGHT_DIRECTION[1] + 1.4 * LIGHT_DIRECTION[2]) / length;
      const dither = BAYER_2[(x & 1) + (y & 1) * 2]!;
      const nail = sample.owner?.nail ?? 0;
      if (nail > 0) {
        const step = nail === 2 ? 1 : Math.max(1, Math.min(NAIL.length - 1, Math.floor(diffuse * 3.2 + dither * 0.35)));
        put(grid, x, y, NAIL[step]!);
        continue;
      }
      const step = Math.max(0, Math.min(SKIN.length - 1, Math.floor(diffuse * 5.2 - 0.6 + dither * 0.35) - (sample.owner?.crease ? 1 : 0)));
      put(grid, x, y, SKIN[step]!);
    }
  }
  return grid;
}

export function closeUpSprites(): CloseUpSprite[] {
  const pieces = CLOSE_UP_SOURCES().map(([name, thing]) => ({
    name: `piece.${name}`,
    grid: inked(thing.size * CLOSE_UP_SCALE, enlarge(thing, CLOSE_UP_SCALE)),
  }));
  return [...pieces, { name: 'piece.ash', grid: ash() }, { name: 'hand.open', grid: paintHand(false) }, { name: 'hand.grip', grid: paintHand(true) }];
}
