import type { Mask } from '../field.ts';
import { and, blob, capsule, not, or, touching } from '../field.ts';
import type { Grid } from '../grid.ts';
import { outline, stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { CHAR, CHAR_WARM, FIRE, INK, SHADOW, STONE, STONE_WARM } from '../palette.ts';
import type { Region } from '../shade.ts';
import { basin, cone, flat, shade } from '../shade.ts';
import type { Clip, Piece, Sprite } from '../sprite.ts';
import { TILT, castShadow, groundShadow } from '../view.ts';

const CELLS = 16;
const FRAMES = 3;

const CENTRE = { x: 8, y: 11 };
const RING = blob(CENTRE.x, CENTRE.y, 6.6, 6.6 * TILT, 0.09, 61);
const BED = blob(CENTRE.x, CENTRE.y, 4.2, 4.2 * TILT, 0.12, 23);
const STONES = and(RING, not(BED));

const FACE = and(and(blob(CENTRE.x, CENTRE.y + 2, 6.6, 6.6 * TILT, 0.09, 61), not(RING)), (_x, y) => y > CENTRE.y);

const LOGS = and(
  or(capsule(5.25, 12, 10, 10.3, 0.8), capsule(6, 9.8, 10.25, 12.2, 0.7)),
  BED,
);

interface Banking {
  clip: string;
  tongues: readonly (readonly [number, number, number])[][];
  ambient: number;
}

const BANKINGS: readonly Banking[] = [
  {
    clip: 'burn-banked',
    tongues: [
      [[8.4, 7.2, 0.8], [6.3, 8.5, 0.6]],
      [[7.4, 7.7, 0.75], [9.7, 8.4, 0.55]],
      [[8.9, 7.4, 0.7], [6.6, 8.7, 0.6]],
    ],
    ambient: 0.45,
  },
  {
    clip: 'burn',
    tongues: [
      [[8, 3.2, 1.3], [5.8, 6.2, 0.9], [10.2, 5.6, 0.9]],
      [[8.6, 2.6, 1.2], [6.2, 5.6, 0.9], [10.6, 6.4, 0.8]],
      [[7.4, 3.6, 1.3], [5.4, 6.6, 0.8], [9.8, 5.2, 1]],
    ],
    ambient: 0.42,
  },
  {
    clip: 'burn-roaring',
    tongues: [
      [[8, 0.9, 1.7], [6, 3.6, 1.2], [10, 3.2, 1.2], [4.9, 6.6, 0.95], [11.1, 6.4, 0.9]],
      [[8.6, 0.6, 1.6], [6.4, 3, 1.2], [10.4, 4, 1.15], [5.2, 6, 0.9], [11.3, 6.8, 0.85]],
      [[7.4, 1.2, 1.7], [5.6, 4, 1.15], [9.6, 2.6, 1.25], [4.7, 6.8, 0.95], [10.6, 6, 0.95]],
    ],
    ambient: 0.56,
  },
];

function flamesFor(banking: Banking, frame: number): Mask {
  const tongues = banking.tongues[frame] ?? banking.tongues[0]!;
  return tongues
    .map(([tipX, tipY, width]): Mask => {
      const baseX = CENTRE.x + (tipX - CENTRE.x) * 0.3;
      const baseY = CENTRE.y - 0.2;
      return or(
        capsule(baseX, baseY, (baseX + tipX) / 2, (baseY + tipY) / 2 + 1, width * 1.6),
        capsule((baseX + tipX) / 2, (baseY + tipY) / 2 + 1, tipX, tipY, width * 0.9),
      );
    })
    .reduce((all, mask) => or(all, mask));
}

const HEARTH_CLIPS: readonly Clip[] = [
  { name: 'bed', frames: FRAMES },
  { name: 'ring', frames: 1 },
  ...BANKINGS.map((banking): Clip => ({ name: banking.clip, frames: FRAMES })),
];

const HEARTH_PIECES: readonly Piece[] = [
  { clip: 'bed', foot: 0 },
  { clip: 'ring', foot: 10.5 },
  { clip: 'burn', foot: 12.85 },
];

const RING_REGIONS: readonly Region[] = [
  { mask: STONES, material: { ramp: STONE, warm: STONE_WARM, relief: 2.2, ambient: 0.12, contrast: 0.3, speckle: 0.24 } },
  { mask: FACE, material: { ramp: STONE, warm: STONE_WARM, profile: flat, relief: 0, ambient: 0.1, contrast: 0.22, speckle: 0.3 } },
  { mask: touching(STONES, BED), material: { ramp: CHAR, warm: CHAR_WARM, relief: 1, ambient: 0.12, contrast: 0.2, speckle: 0.3 } },
];

const BED_REGIONS: readonly Region[] = [
  { mask: BED, material: { ramp: FIRE, profile: basin, relief: 1.5, ambient: 0.06, contrast: 0.11 } },
  { mask: LOGS, material: { ramp: CHAR, warm: CHAR_WARM, relief: 1.1, ambient: 0.04, contrast: 0.07, speckle: 0.18 } },
];

const flameRegion = (banking: Banking, frame: number): Region => ({
  mask: flamesFor(banking, frame),
  material: { ramp: FIRE, profile: cone, relief: 2.5, ambient: banking.ambient, contrast: 0.05 },
});

const emberRegion = (frame: number): Region => ({
  mask: blob(CENTRE.x, CENTRE.y - 0.8, 3.2, 1.15, 0.16, 41 + frame),
  material: { ramp: FIRE, relief: 1.1, ambient: 0.26, contrast: 0.12, speckle: 0.3 },
});

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

function fireFor(frame: number): Light[] {
  const flare = [1, 0.82, 0.93][frame] ?? 1;
  const leanX = [0, -0.35, 0.3][frame] ?? 0;
  const leanY = [0, 0.2, -0.15][frame] ?? 0;

  return [
    { kind: 'glow', x: CENTRE.x + leanX, y: CENTRE.y - 1 + leanY, reach: 8.75, strength: 7 * flare, flatten: 1.4 },
    {
      kind: 'rings',
      x: CENTRE.x + leanX,
      y: CENTRE.y + leanY,
      spacing: 1.55,
      breaks: 3,
      rotation: frame * 1.1,
      reach: 5,
      strength: 1.1 * flare,
      flatten: 1.4,
    },
  ];
}

const EMBERS: [number, number][][] = [
  [[6, 12], [9, 11]],
  [[5, 11], [10, 12]],
  [[9, 12], [6, 10]],
];

function draw(lights: readonly Light[], clip: string, frame: number): Grid {
  const fire = [...lights, ...fireFor(frame)];

  const banking = BANKINGS.find((entry) => entry.clip === clip);
  if (banking) {
    const ember = banking === BANKINGS[0] ? [emberRegion(frame)] : [];
    return shade(CELLS, [...ember, flameRegion(banking, frame)], fire);
  }

  if (clip === 'ring') {
    const ring = shade(CELLS, RING_REGIONS, fire);
    outline(ring, INK);
    castShadow(ring, groundShadow(CENTRE.x, CENTRE.y + 4.5, 12, 67, 0.2), SHADOW);
    return ring;
  }

  const bed = shade(CELLS, BED_REGIONS, fire);
  for (const [x, y] of EMBERS[frame] ?? []) {
    if (BED(x, y)) stamp(bed, x, y, [[0, 0, FIRE[7]!], [1, 0, FIRE[5]!]]);
  }
  return bed;
}

export const hearth: Sprite = {
  name: 'hearth',
  cells: CELLS,
  clips: HEARTH_CLIPS,
  pieces: HEARTH_PIECES,
  lights: [SUN],
  draw,
};
