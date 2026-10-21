import { and, blob, capsule, not, or, touching } from '../field.ts';
import type { Mask } from '../field.ts';
import { outline, stamp } from '../grid.ts';
import type { Grid } from '../grid.ts';
import type { Light } from '../light.ts';
import { CHAR, CHAR_WARM, FIRE, INK, SHADOW, STONE, STONE_WARM } from '../palette.ts';
import { basin, cone, flat, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Clip, Piece, Sprite } from '../sprite.ts';
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
 * The fire at its three bankings, which is the one knob a fire rig has (`CHARGE_STEPS`).
 *
 * The control and the readout are the same drawing: the player picks a banked, a steady or a
 * roaring fire off the room's slab, and this is that fire standing on the map. Three drawings
 * rather than one flame scaled, because a banked fire is not a short blaze — it is mostly
 * ember, with a lick or two off the coals, where a roaring one is a column the bed disappears
 * under. The bed and the stones are the same underneath all three: what the town built does not
 * change when somebody opens the damper.
 *
 * A tongue is a tip, and a half-width at the base: broad where it leaves the coals, thin where
 * it goes out. Each frame leans them differently, so every banking still flickers.
 */
interface Banking {
  clip: string;
  tongues: readonly (readonly [number, number, number])[][];
  /** The step of the fire ramp the flame sits on, before any light: a hotter fire is paler. */
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

/**
 * The fire is three drawings, not one, because it is three things standing at three distances.
 *
 * The bed *lies in the ground*, the ring of stones *stands round it* half a parcel nearer the
 * viewer, and the flames *rise out of the middle*. A villager at the fireside belongs in among
 * them — behind the flames and in front of the near stones — and one picture can only carry one
 * foot, so whichever it is given is wrong for the other two. Each is a clip with the row it meets
 * the ground on, and the painter sorts all three beside the villager.
 */
const HEARTH_CLIPS: readonly Clip[] = [
  { name: 'bed', frames: FRAMES },
  { name: 'ring', frames: 1 },
  ...BANKINGS.map((banking): Clip => ({ name: banking.clip, frames: FRAMES })),
];

/**
 * Settled on the lab's depth bench, not computed: where each of these reads as standing is a
 * question about the drawing, and the bench is where it was asked (`lab/Clip.tsx`).
 *
 * The bed *lies in the ground*, so it takes the back of the grid like any other flat thing and
 * goes down under everything near it. The ring is low and sits round the pit; the flames stand up
 * out of the middle and come last, over the stones, which is what reads as a fire in a ring rather
 * than a ring in front of a fire.
 */
// The three bankings are one piece, not three: they are the same fire standing in the same bed,
// so the painter puts `burn` in the sort and draws whichever banking the rig is being driven at.
const HEARTH_PIECES: readonly Piece[] = [
  { clip: 'bed', foot: 0 },
  { clip: 'ring', foot: 10.5 },
  { clip: 'burn', foot: 12.85 },
];

const RING_REGIONS: readonly Region[] = [
  { mask: STONES, material: { ramp: STONE, warm: STONE_WARM, relief: 2.2, ambient: 0.12, contrast: 0.3, speckle: 0.24 } },
  { mask: FACE, material: { ramp: STONE, warm: STONE_WARM, profile: flat, relief: 0, ambient: 0.1, contrast: 0.22, speckle: 0.3 } },
  // Soot where the flame licks the stone. It belongs to the stone it is on, not to the fire.
  { mask: touching(STONES, BED), material: { ramp: CHAR, warm: CHAR_WARM, relief: 1, ambient: 0.12, contrast: 0.2, speckle: 0.3 } },
];

const BED_REGIONS: readonly Region[] = [
  // The bed sits *below* the stones and is lit almost entirely by its own fire, so the sun gets
  // very little of the ramp and the glow gets the rest.
  { mask: BED, material: { ramp: FIRE, profile: basin, relief: 1.5, ambient: 0.06, contrast: 0.11 } },
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
const flameRegion = (banking: Banking, frame: number): Region => ({
  mask: flamesFor(banking, frame),
  // Barely any of the glow: the fire is lit seven times over by its own light, and a flame given
  // a fair share of that saturates to one pale blob. Its shape comes from the profile instead —
  // bright down the spine, darker orange at the edges.
  material: { ramp: FIRE, profile: cone, relief: 2.5, ambient: banking.ambient, contrast: 0.05 },
});

/**
 * The coals a banked fire is mostly made of, heaped over the middle of the bed.
 *
 * Shorter tongues on their own came out as the same fire further away rather than as a fire
 * damped down. What a banked fire is is a heap of embers with a lick off it, so the heap is
 * drawn: speckled, because coals are broken, and standing low enough that the logs in the bed
 * still show round it.
 */
const emberRegion = (frame: number): Region => ({
  mask: blob(CENTRE.x, CENTRE.y - 0.8, 3.2, 1.15, 0.16, 41 + frame),
  material: { ramp: FIRE, relief: 1.1, ambient: 0.26, contrast: 0.12, speckle: 0.3 },
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
function draw(lights: readonly Light[], clip: string, frame: number): Grid {
  // Every piece is lit by the same fire, whichever piece it is: the stones are warmed by the
  // flames they stand round, and a bed lit by one frame's flame and ringed by another's would
  // disagree with itself about where the fire is.
  const fire = [...lights, ...fireFor(frame)];

  // The flames have no outline, and that is why they are their own pass as well as their own
  // piece: inked, a tongue a cell or two wide is nothing *but* outline, and the tips stood up out
  // of the fire as black sticks.
  const banking = BANKINGS.find((entry) => entry.clip === clip);
  if (banking) {
    const ember = banking === BANKINGS[0] ? [emberRegion(frame)] : [];
    return shade(CELLS, [...ember, flameRegion(banking, frame)], fire);
  }

  if (clip === 'ring') {
    const ring = shade(CELLS, RING_REGIONS, fire);
    outline(ring, INK);
    // The ring is what stands up here, so the shadow on the ground is the ring's.
    castShadow(ring, groundShadow(CENTRE.x, CENTRE.y + 4.5, 12, 67, 0.2), SHADOW);
    return ring;
  }

  // The bed takes no outline: it is a hollow in the ground with the stones round it, and inked on
  // its own it comes out as a disc somebody drew, with a hard edge where the stones meet it.
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
