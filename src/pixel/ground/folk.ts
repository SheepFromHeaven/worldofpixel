import type { Ramp } from '../color.ts';
import { blob, capsule } from '../field.ts';
import { AUBURN, BREATH, FIRE, HAIR, SKIN, WOOD } from '../palette.ts';
import type { Region } from '../shade.ts';
import type { Bump, LitProp, Standing, Traits } from './objects.ts';
import { crownOf, lit } from './objects.ts';
import { BLOCK_ARTS } from '../../content/blocks/art.ts';
import { STATION_ARTS } from '../../content/stations/art.ts';
import { ITEM_ARTS } from '../../content/items/art.ts';
import { GLOW, material, middle, piece, plot, polar, STILL } from './kit.ts';

const CASTS: Traits = { sway: 0, canopy: false, bend: false, torchShadow: true };


type Pose = 'stand' | 'walk2' | 'walk1' | 'walk0' | 'walkM1' | 'walkM2' | 'kneel' | 'reach' | 'lie';

type Facing = 's' | 'n' | 'e';

export const POSES: readonly Pose[] = ['stand', 'walk2', 'walk1', 'walk0', 'walkM1', 'walkM2', 'kneel', 'reach', 'lie'];

export const FACINGS: readonly Facing[] = ['s', 'n', 'e'];

export const PEOPLE = ['adam', 'eve'] as const;

export const STANDING_HEIGHT = 14;

export const KNEELING_HEIGHT = 9;

export const LYING_HEIGHT = 3;

const PERSON_SIZE = 32;

const FORWARD: Record<Facing, readonly [number, number]> = { s: [0, 1], n: [0, -1], e: [1, 0] };

const ACROSS: Record<Facing, readonly [number, number]> = { s: [1, 0], n: [1, 0], e: [0, 1] };

interface Build {
  hair: Ramp;
  span: number;
  girth: number;
  long: boolean;
}

const BUILDS: Record<(typeof PEOPLE)[number], Build> = {
  adam: { hair: HAIR, span: 3.6, girth: 3.1, long: false },
  eve: { hair: AUBURN, span: 3.1, girth: 2.8, long: true },
};

interface Stance {
  lean: number;
  head: number;
  hands: readonly [number, number];
  spread: number;
  feet: readonly [number, number];
  twist: number;
}

const STRIDE_FEET = 3.6;

const STRIDE_HANDS = 3;

const STRIDE_TWIST = 0.55;

const walking = (swing: number): Stance => ({
  lean: 0.5,
  head: 1.1,
  hands: [1 - STRIDE_HANDS * swing, 1 + STRIDE_HANDS * swing],
  spread: 1.1,
  feet: [STRIDE_FEET * swing, -STRIDE_FEET * swing],
  twist: STRIDE_TWIST * swing,
});

const STANCES: Record<Pose, Stance> = {
  stand: { lean: 0, head: 0.6, hands: [1.5, 1.5], spread: 1.1, feet: [0, 0], twist: 0 },
  walk2: walking(1),
  walk1: walking(0.5),
  walk0: walking(0),
  walkM1: walking(-0.5),
  walkM2: walking(-1),
  kneel: { lean: 1.8, head: 2.6, hands: [4.6, 4.6], spread: -0.4, feet: [-3.4, -3.4], twist: 0 },
  reach: { lean: 1.6, head: 2.6, hands: [5.8, 5.8], spread: 0.4, feet: [0, 0], twist: 0 },
  lie: { lean: 2, head: 6, hands: [-2, -2], spread: 0.9, feet: [-11, -11], twist: 0 },
};

function person(who: (typeof PEOPLE)[number], pose: Pose, facing: Facing): Standing {
  const build = BUILDS[who];
  const stance = STANCES[pose];
  const [fx, fy] = FORWARD[facing];
  const [sx, sy] = ACROSS[facing];
  const centre = { x: PERSON_SIZE / 2, y: PERSON_SIZE / 2 };
  const seed = who === 'adam' ? 7 : 19;

  const at = (along: number, across: number): { x: number; y: number } => ({
    x: centre.x + fx * along + sx * across,
    y: centre.y + fy * along + sy * across,
  });

  const head = at(stance.head, 0);
  const shoulderLeft = at(stance.lean - stance.twist, -build.span);
  const shoulderRight = at(stance.lean + stance.twist, build.span);
  const handAt = (index: 0 | 1): { x: number; y: number } =>
    at(stance.hands[index], (index === 0 ? -1 : 1) * (build.span + stance.spread));
  const footAt = (index: 0 | 1): { x: number; y: number } => at(stance.feet[index], (index === 0 ? -1 : 1) * 1.7);

  const skin = material(SKIN.slice(3), 1.4, 0.1, 0.15);
  const hair = material(build.hair, 1.2, 0.35, 0.3);
  const leather = material(WOOD.slice(0, 3), 1, 0.2, 0.2);

  const regions: Region[] = [
    { mask: blob(footAt(0).x, footAt(0).y, 1.8, 1.8, 0.1, seed + 1), material: leather },
    { mask: blob(footAt(1).x, footAt(1).y, 1.8, 1.8, 0.1, seed + 2), material: leather },
    { mask: capsule(shoulderLeft.x, shoulderLeft.y, shoulderRight.x, shoulderRight.y, build.girth), material: skin },
    { mask: blob(handAt(0).x, handAt(0).y, 1.6, 1.6, 0.1, seed + 3), material: skin },
    { mask: blob(handAt(1).x, handAt(1).y, 1.6, 1.6, 0.1, seed + 4), material: skin },
  ];

  if (pose === 'lie') {
    const hips = at(-7, 0);
    regions.push({ mask: capsule(at(stance.lean, 0).x, at(stance.lean, 0).y, hips.x, hips.y, build.girth), material: skin });
  }

  if (build.long) {
    const back = at(stance.head - 5.5, 0);
    regions.push({ mask: capsule(head.x, head.y, back.x, back.y, 1.6), material: hair });
  }
  regions.push({ mask: blob(head.x, head.y, 2.4, 2.4, 0.06, seed + 5), material: skin });
  const crownOfHead = facing === 'n' ? head : at(stance.head - 1.5, 0);
  regions.push({ mask: blob(crownOfHead.x, crownOfHead.y, facing === 'n' ? 2.4 : 1.9, facing === 'n' ? 2.4 : 1.9, 0.1, seed + 6), material: hair });

  const bumps: Bump[] = [
    { x: head.x, y: head.y, r: 2.8, h: 3.6 },
    { x: shoulderLeft.x, y: shoulderLeft.y, r: build.girth + 0.6, h: 2.4 },
    { x: shoulderRight.x, y: shoulderRight.y, r: build.girth + 0.6, h: 2.4 },
    { x: handAt(0).x, y: handAt(0).y, r: 1.6, h: 1.6 },
    { x: handAt(1).x, y: handAt(1).y, r: 1.6, h: 1.6 },
    { x: footAt(0).x, y: footAt(0).y, r: 1.7, h: 0.8 },
    { x: footAt(1).x, y: footAt(1).y, r: 1.7, h: 0.8 },
  ];

  return {
    size: PERSON_SIZE,
    foot: { x: PERSON_SIZE / 2, y: PERSON_SIZE / 2 },
    shadow: () => false,
    height: pose === 'kneel' ? KNEELING_HEIGHT : pose === 'lie' ? LYING_HEIGHT : STANDING_HEIGHT,
    crown: crownOf(bumps),
    regions,
  };
}

const people = (): LitProp[] =>
  PEOPLE.flatMap((who) =>
    POSES.flatMap((pose) => FACINGS.map((facing) => lit(`person.${who}.${pose}.${facing}`, {}, person(who, pose, facing), 1, CASTS))),
  );




















function spark(): Standing {
  const size = 5;
  const foot = middle(size);
  return piece(
    size,
    [
      { mask: blob(foot.x, foot.y, 1.5, 1.5, 0.1, 3), material: material([FIRE[5]!], 0.4, 0, 0) },
      { mask: blob(foot.x, foot.y, 0.8, 0.8, 0.1, 4), material: material([FIRE[7]!], 0.4, 0, 0) },
    ],
    2,
  );
}

export const BREATH_FRAMES = 3;

function breath(frame: number): Standing {
  const size = 9;
  const foot = middle(size);
  const reach = 1.3 + frame * 0.9;
  const regions: Region[] = [
    { mask: blob(foot.x, foot.y, reach, reach * 0.85, 0.2, 90 + frame), material: material([BREATH[0]!], 0.3, 0, 0) },
    { mask: blob(foot.x, foot.y, reach * 0.55, reach * 0.5, 0.2, 94 + frame), material: material([BREATH[1]!], 0.3, 0, 0) },
  ];
  for (let i = 0; i < frame; i += 1) {
    const at = polar(foot, i * 2.4 + 0.7, reach + 0.6);
    regions.push({ mask: blob(at.x, at.y, 0.7, 0.7, 0.1, 98 + i), material: material([BREATH[0]!], 0.3, 0, 0) });
  }
  return piece(size, regions, 2);
}








export const CLOSE_UP_SOURCES = (): readonly (readonly [string, Standing])[] => ITEM_ARTS.flatMap(([, art]) => art.closeUps?.() ?? []);

export const LIT_FOLK: readonly LitProp[] = [
  ...people(),
  ...ITEM_ARTS.flatMap(([, art]) => art.sprites?.() ?? []),
  ...STATION_ARTS.flatMap((art) => art.sprites?.() ?? []),
  ...BLOCK_ARTS.flatMap((art) => art.sprites?.() ?? []),
  lit('marker.plan', {}, plot(), 1, STILL),
  lit('marker.spark', {}, spark(), 1, GLOW),
  ...Array.from({ length: BREATH_FRAMES }, (_, frame) => lit(`marker.breath.${frame}`, {}, breath(frame), 1, GLOW)),
];
