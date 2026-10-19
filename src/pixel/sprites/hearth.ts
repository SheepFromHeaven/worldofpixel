import { and, blob, capsule, not, or, touching } from '../field.ts';
import { outline, stamp } from '../grid.ts';
import type { Grid } from '../grid.ts';
import type { Light } from '../light.ts';
import { CHAR, CHAR_WARM, FIRE, INK, STONE, STONE_WARM } from '../palette.ts';
import { basin, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Sprite } from '../sprite.ts';

const CELLS = 16;
const FRAMES = 3;

/** The ring of stones, and the bed of fire they hold. */
const RING = blob(7.75, 8, 6.75, 5.75, 0.09, 61);
const BED = blob(7.75, 8, 4.25, 3.4, 0.12, 23);
const STONES = and(RING, not(BED));

/** Two logs across the fire, clipped to the bed so they lie *in* the pit rather than over it. */
const LOGS = and(
  or(capsule(5.25, 9.5, 10, 7.25, 0.85), capsule(6, 6.25, 10.25, 9.75, 0.75)),
  BED,
);

const REGIONS: readonly Region[] = [
  { mask: STONES, material: { ramp: STONE, warm: STONE_WARM, relief: 2.5, ambient: 0.08, contrast: 0.26, speckle: 0.24 } },
  // The bed sits *below* the stones and is lit almost entirely by its own fire, so the sun gets
  // very little of the ramp and the glow gets the rest.
  { mask: BED, material: { ramp: FIRE, profile: basin, relief: 1.5, ambient: 0.06, contrast: 0.11 } },
  // Soot where the flame licks the stone.
  { mask: touching(STONES, BED), material: { ramp: CHAR, warm: CHAR_WARM, relief: 1, ambient: 0.12, contrast: 0.2, speckle: 0.3 } },
  // The logs go last, over the fire they are lying in — and as a region rather than a stamp, so
  // the fire lights them. Stamped on afterwards they were unlit, which against a blazing bed
  // came out as two black bars.
  //
  // They take very little of the light on purpose. Wood in a fire is the *dark* thing in it, lit
  // at its edges and charred everywhere else; given the same share of the ramp as the bed they
  // burn out to the same orange and disappear into it, which is what happened first.
  { mask: LOGS, material: { ramp: CHAR, warm: CHAR_WARM, relief: 1.1, ambient: 0.04, contrast: 0.07, speckle: 0.18 } },
];

/**
 * The fire, as three states rather than a continuous flicker.
 *
 * Each frame moves the glow a little and changes how fiercely it burns, which is enough to read
 * as a fire without the flames ever being drawn as shapes — the light does the work, so the
 * frames cannot disagree with each other about where the fire is.
 */
const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

function fireFor(frame: number): Light[] {
  const flare = [1, 0.82, 0.93][frame] ?? 1;
  const leanX = [0, -0.35, 0.3][frame] ?? 0;
  const leanY = [0, 0.2, -0.15][frame] ?? 0;

  return [
    { kind: 'glow', x: 7.75 + leanX, y: 8 + leanY, reach: 8.75, strength: 7 * flare, flatten: 1.2 },
    {
      kind: 'rings',
      x: 7.75 + leanX,
      y: 8 + leanY,
      spacing: 1.55,
      breaks: 3,
      rotation: frame * 1.1,
      reach: 5,
      strength: 1.1 * flare,
      flatten: 1.2,
    },
  ];
}

const EMBERS: [number, number][][] = [
  [[6, 6], [9, 9]],
  [[6, 9], [10, 6]],
  [[9, 10], [6, 8]],
];

/**
 * The sun comes from outside — the lab hands it back moved, and every sprite shares it — but the
 * fire belongs to the frame, so it is added here rather than stored on the sprite. That is what
 * keeps a frame from being lit by another frame's flame.
 */
function draw(lights: readonly Light[], _clip: string, frame: number): Grid {
  const grid = shade(CELLS, REGIONS, [...lights, ...fireFor(frame)]);

  for (const [x, y] of EMBERS[frame] ?? []) {
    stamp(grid, x, y, [[0, 0, FIRE[7]!], [1, 0, FIRE[5]!]]);
  }

  outline(grid, INK);
  return grid;
}

export const hearth: Sprite = {
  name: 'hearth',
  cells: CELLS,
  clips: [{ name: 'burn', frames: FRAMES }],
  lights: [SUN],
  draw,
};
