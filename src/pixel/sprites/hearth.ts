import { and, blob, capsule, not, or, touching } from '../field.ts';
import type { Mask } from '../field.ts';
import { outline, stamp } from '../grid.ts';
import type { Grid } from '../grid.ts';
import type { Light } from '../light.ts';
import { CHAR, CHAR_WARM, FIRE, INK, SHADOW, STONE, STONE_WARM } from '../palette.ts';
import { basin, cone, flat, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Sprite } from '../sprite.ts';
import { TILT, castShadow, groundShadow } from '../view.ts';

const CELLS = 16;
const FRAMES = 3;

/**
 * The hearth in the map's three-quarter view (`view.ts`): a low ring of stones seen from above
 * and in front, the bed of embers inside it, and the flames standing up out of it.
 *
 * Drawn from overhead it was a glowing disc, and the fire was only ever light — which from
 * above is all a fire is, and from where a person stands is the least of it. The flames are
 * what make it the middle of a town.
 */
const CENTRE = { x: 8, y: 11 };
const RING = blob(CENTRE.x, CENTRE.y, 6.6, 6.6 * TILT, 0.09, 61);
const BED = blob(CENTRE.x, CENTRE.y, 4.2, 4.2 * TILT, 0.12, 23);
const STONES = and(RING, not(BED));

/** The near face of the ring: the stones are low, so it shows two cells of them. */
const FACE = and(and(blob(CENTRE.x, CENTRE.y + 2, 6.6, 6.6 * TILT, 0.09, 61), not(RING)), (_x, y) => y > CENTRE.y);

/** Two logs across the fire, clipped to the bed so they lie *in* the pit rather than over it. */
const LOGS = and(
  or(capsule(5.25, 12, 10, 10.3, 0.8), capsule(6, 9.8, 10.25, 12.2, 0.7)),
  BED,
);

/**
 * The flames: three tongues out of the bed, a tall one and two that lean away from it, each
 * frame a different lean and height. A tongue is a broad base and a thin tip, so it tapers.
 */
const TONGUES: readonly (readonly [number, number, number])[][] = [
  [[8, 3.2, 1.3], [5.8, 6.2, 0.9], [10.2, 5.6, 0.9]],
  [[8.6, 2.6, 1.2], [6.2, 5.6, 0.9], [10.6, 6.4, 0.8]],
  [[7.4, 3.6, 1.3], [5.4, 6.6, 0.8], [9.8, 5.2, 1]],
];

function flamesFor(frame: number): Mask {
  const tongues = TONGUES[frame] ?? TONGUES[0]!;
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

const REGIONS: readonly Region[] = [
  { mask: STONES, material: { ramp: STONE, warm: STONE_WARM, relief: 2.2, ambient: 0.12, contrast: 0.3, speckle: 0.24 } },
  { mask: FACE, material: { ramp: STONE, warm: STONE_WARM, profile: flat, relief: 0, ambient: 0.1, contrast: 0.22, speckle: 0.3 } },
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
 * The flames, as a region of their own on top of everything. Their light is their own, not the
 * sun's: they sit high in the ramp and the glow takes them up to the pale heart at the root.
 */
const flameRegion = (frame: number): Region => ({
  mask: flamesFor(frame),
  // Barely any of the glow: the fire is lit seven times over by its own light, and a flame given
  // a fair share of that saturates to one pale blob. Its shape comes from the profile instead —
  // bright down the spine, darker orange at the edges.
  material: { ramp: FIRE, profile: cone, relief: 2.5, ambient: 0.42, contrast: 0.05 },
});

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

/**
 * The sun comes from outside — the lab hands it back moved, and every sprite shares it — but the
 * fire belongs to the frame, so it is added here rather than stored on the sprite. That is what
 * keeps a frame from being lit by another frame's flame.
 */
function draw(lights: readonly Light[], _clip: string, frame: number): Grid {
  const fire = [...lights, ...fireFor(frame)];
  const grid = shade(CELLS, REGIONS, fire);

  for (const [x, y] of EMBERS[frame] ?? []) {
    if (BED(x, y)) stamp(grid, x, y, [[0, 0, FIRE[7]!], [1, 0, FIRE[5]!]]);
  }

  outline(grid, INK);

  // The flames after the ink, from a pass of their own: fire has no outline. Inked, a tongue a
  // cell or two wide is nothing *but* outline, and the tips stood up out of the fire as black
  // sticks.
  const flames = shade(CELLS, [flameRegion(frame)], fire);
  for (let at = 0; at < flames.cells.length; at += 1) {
    if ((flames.cells[at]! & 0xff) !== 0) grid.cells[at] = flames.cells[at]!;
  }
  castShadow(grid, groundShadow(CENTRE.x, CENTRE.y + 4.5, 12, 67, 0.2), SHADOW);
  return grid;
}

export const hearth: Sprite = {
  name: 'hearth',
  cells: CELLS,
  clips: [{ name: 'burn', frames: FRAMES }],
  lights: [SUN],
  draw,
};
