import { and, blob, capsule, not, or } from '../field.ts';
import { outline } from '../grid.ts';
import type { Grid } from '../grid.ts';
import type { Light } from '../light.ts';
import { CLOTH, HAIR, INK, SKIN } from '../palette.ts';
import { dome, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Sprite } from '../sprite.ts';

const CELLS = 16;

/**
 * A tribesperson, built as a skeleton rather than drawn as pixels.
 *
 * Limbs are capsules whose ends move, and the shading system lights whatever shape results — so
 * a frame of the walk is four numbers rather than a hand-placed figure, and all four frames are
 * lit identically because they go through the same sun. Hand-placing sixteen-cell figures four
 * times is where walk cycles usually start disagreeing with themselves.
 *
 * Sixteen cells because that is what the map gives: a villager is about fifteen buffer pixels
 * tall at the middle of the parcel zoom. At that size a person is a silhouette — head, shoulders,
 * two legs — and detail below that threshold only muddies the outline.
 */

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

/** Where the body is when the legs are together; a step swings the feet either side of it. */
const HIP = { x: 8, y: 11 };
const SHOULDER = { x: 8, y: 7.2 };

interface Pose {
  /** How far through the stride, as a signed swing. */
  swing: number;
  /** A body rises once per step, not once per cycle. */
  bob: number;
  /** Arms up over the head, holding whatever is being carried. */
  holding?: boolean;
  /** Shifts the upper body alone, for a breath while standing. */
  breath?: number;
}

/**
 * The clips, as tables of poses.
 *
 * Standing still is not frame nought of the walk — it is its own short loop, and carrying is the
 * walk with the arms somewhere else. Keeping them as separate tables means a change to the
 * stride cannot quietly alter how someone stands.
 */
const CLIPS: Record<string, readonly Pose[]> = {
  walk: [
    { swing: 0, bob: 0 },
    { swing: 1, bob: -1 },
    { swing: 0, bob: 0 },
    { swing: -1, bob: -1 },
  ],
  carry: [
    { swing: 0, bob: 0, holding: true },
    { swing: 1, bob: -1, holding: true },
    { swing: 0, bob: 0, holding: true },
    { swing: -1, bob: -1, holding: true },
  ],
  idle: [
    { swing: 0, bob: 0 },
    { swing: 0, bob: 0, breath: 1 },
  ],
};

function regionsFor(clip: string, frame: number): readonly Region[] {
  const poses = CLIPS[clip] ?? CLIPS.walk!;
  const pose = poses[frame % poses.length] ?? poses[0]!;
  const { swing, bob } = pose;
  const lift = (y: number): number => y + bob;
  // The breath moves the chest, arms and head and leaves the feet where they are. Lifting the
  // whole figure instead reads as a hop.
  const chest = (y: number): number => y + bob + (pose.breath ?? 0);

  const stride = swing * 1.5;
  const reach = swing * 1.1;

  // Legs first so the tunic hangs over them, arms before the body so they read as behind it.
  const legs = or(
    capsule(7.2, lift(HIP.y), 7.2 + stride, lift(14.8), 1.05),
    capsule(8.8, lift(HIP.y), 8.8 - stride, lift(14.8), 1.05),
  );

  // Arms hang at the sides and swing mostly in depth, which from the front is up and down. Swung
  // out sideways instead they read as wings, which is what the first pass did.
  //
  // Carrying raises them up the *sides* of the head, not over it. Brought together above the
  // crown they frame the head like a pair of ears and the figure stops reading as a person;
  // alongside, the silhouette stays human and the space over the head is left clear for the
  // load. Arms held out in front would just be a slightly wider blob at this size.
  //
  // Held wide of the head rather than against it, and thicker than the hanging arms. Flush with
  // the skull the three run together into one lump; and at the width an arm hangs at, the
  // outline eats a cell from either side and leaves a dark bar with no skin in it, which reads
  // as long hair rather than as a raised arm. An arm has to be three cells across here to still
  // be an arm once it has been inked.
  const arms = pose.holding
    ? or(
        capsule(5.9, chest(SHOULDER.y), 5.0, chest(4.2), 1.2),
        capsule(10.1, chest(SHOULDER.y), 11.0, chest(4.2), 1.2),
      )
    : or(
        capsule(5.9, chest(SHOULDER.y), 5.6, chest(10.8 - reach), 0.85),
        capsule(10.1, chest(SHOULDER.y), 10.4, chest(10.8 + reach), 0.85),
      );

  // A wrap, not a coat: shoulder to above the knee. Deliberately broad — a narrower figure was
  // better proportioned and had less character, and at sixteen cells character is worth more
  // than anatomy. The big head and heavy tunic are what make it read as a person rather than as
  // a marker, which is the only job it has at this size.
  const tunic = capsule(SHOULDER.x, chest(SHOULDER.y), HIP.x, lift(11.4), 2.2);
  const head = blob(8, chest(3.6), 2.7, 2.9, 0.06, 5);
  // Hair sits over the back of the skull, leaving the face clear.
  const hair = and(head, not(blob(8.3, chest(4.5), 2.2, 2.2, 0.05, 9)));

  return [
    { mask: legs, material: { ramp: SKIN, profile: dome, relief: 1.6, ambient: 0.12, contrast: 0.7 } },
    { mask: arms, material: { ramp: SKIN, profile: dome, relief: 1.4, ambient: 0.1, contrast: 0.7 } },
    { mask: tunic, material: { ramp: CLOTH, profile: dome, relief: 2.4, ambient: 0.12, contrast: 0.72, speckle: 0.18 } },
    { mask: head, material: { ramp: SKIN, profile: dome, relief: 2.4, ambient: 0.15, contrast: 0.7 } },
    { mask: hair, material: { ramp: HAIR, profile: dome, relief: 1.8, ambient: 0.18, contrast: 0.6 } },
  ];
}

/**
 * Masks are rebuilt every frame because the limbs move, so the depth-field cache misses — which
 * would matter if this ran per frame in the game and does not, because it runs four times in the
 * bake and never again.
 */
function draw(lights: readonly Light[], clip: string, frame: number): Grid {
  const grid = shade(CELLS, regionsFor(clip, frame), lights);
  outline(grid, INK);
  return grid;
}

export const villager: Sprite = {
  name: 'villager',
  cells: CELLS,
  clips: [
    { name: 'walk', frames: 4 },
    { name: 'carry', frames: 4 },
    // Slow, or a standing villager vibrates.
    { name: 'idle', frames: 2, fps: 2 },
  ],
  lights: [SUN],
  draw,
};
