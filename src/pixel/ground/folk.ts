import type { Ramp } from '../color.ts';
import { blob, capsule } from '../field.ts';
import { AUBURN, BREATH, CHAR, ITEM_CHESTNUT, ITEM_FLINT, ITEM_LIMESTONE, ITEM_STRAW, CORD, FIRE, HAIR, SKIN, STONE, WOOD } from '../palette.ts';
import type { Material, Region } from '../shade.ts';
import { cone, dome } from '../shade.ts';
import type { Bump, LitProp, Standing, Traits } from './objects.ts';
import { crownOf, lit } from './objects.ts';

const STILL: Traits = { sway: 0, canopy: false, bend: false };

const INKED: Traits = { sway: 0, canopy: false, bend: false, inked: true };

const GLOW: Traits = { sway: 0, canopy: false, bend: false, emit: true };

const material = (ramp: Ramp, relief = 1.5, grit = 0.2, speckle = 0.25, profile = dome): Material => ({
  ramp,
  profile,
  relief,
  ambient: 0.1,
  contrast: 0.85,
  speckle,
  grit,
});

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
    POSES.flatMap((pose) => FACINGS.map((facing) => lit(`person.${who}.${pose}.${facing}`, {}, person(who, pose, facing), 1, STILL))),
  );

const middle = (size: number): { x: number; y: number } => ({ x: Math.floor(size / 2), y: Math.floor(size / 2) });

const piece = (size: number, regions: readonly Region[], height: number): Standing => ({
  size,
  foot: middle(size),
  shadow: () => false,
  height,
  regions,
});

const polar = (from: { x: number; y: number }, angle: number, reach: number): { x: number; y: number } => ({
  x: from.x + Math.cos(angle) * reach,
  y: from.y + Math.sin(angle) * reach,
});

export const SMALL_SIZE = 12;

function flint(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const turn = variant * 1.3;
  const regions: Region[] = [0, 1].map((i) => {
    const at = polar(foot, turn + i * Math.PI, i === 0 ? 0.9 : 1.2);
    const reach = 1.7 + ((variant + i) % 3) * 0.25;
    return { mask: blob(at.x, at.y, reach * 1.25, reach * 0.8, 0.22, variant * 11 + i), material: material(ITEM_FLINT, 2, 0.5, 0.2, cone) };
  });
  return piece(SMALL_SIZE, regions, 2);
}

function stone(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const reach = 2.7 + variant * 0.25;
  return piece(SMALL_SIZE, [{ mask: blob(foot.x, foot.y, reach, reach * 0.88, 0.3, variant * 5 + 3), material: material(ITEM_LIMESTONE, 2.4, 0.4, 0.25, cone) }], 3);
}

function kindling(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const regions: Region[] = Array.from({ length: 3 }, (_, i) => {
    const angle = variant * 0.7 + i * 0.5;
    const near = polar(foot, angle, -3);
    const far = polar(foot, angle, 3);
    return { mask: capsule(near.x, near.y + (i - 1) * 1.8, far.x, far.y + (i - 1) * 1.8, 0.85), material: material(ITEM_STRAW, 1, 0.3, 0.3) };
  });
  return piece(SMALL_SIZE, regions, 1);
}

function branch(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const angle = variant * 0.8 + 0.3;
  const near = polar(foot, angle, -3.4);
  const far = polar(foot, angle, 3.4);
  const joint = polar(foot, angle, 0.6);
  const twig = polar(joint, angle + 0.9, 2.4);
  const bark = material(ITEM_CHESTNUT, 1.4, 0.5, 0.4);
  return piece(
    SMALL_SIZE,
    [
      { mask: capsule(near.x, near.y, far.x, far.y, 1.15), material: bark },
      { mask: capsule(joint.x, joint.y, twig.x, twig.y, 0.85), material: bark },
    ],
    2,
  );
}

function torch(variant: number): Standing {
  const foot = middle(SMALL_SIZE);
  const angle = variant * 0.8 + 0.3;
  const near = polar(foot, angle, -3.4);
  const far = polar(foot, angle, 3.4);
  const bark = material(ITEM_CHESTNUT, 1.4, 0.5, 0.4);
  return piece(
    SMALL_SIZE,
    [
      { mask: capsule(near.x, near.y, far.x, far.y, 1.15), material: bark },
      { mask: blob(far.x, far.y, 1.5, 1.5, 0.15, variant * 7 + 5), material: material(CHAR, 1.2, 0.5, 0.4) },
    ],
    2,
  );
}

function axe(variant: number): Standing {
  const size = 20;
  const foot = middle(size);
  const angle = variant * 0.7 - 0.5;
  const butt = polar(foot, angle, -6);
  const neck = polar(foot, angle, 4);
  const head = polar(foot, angle, 5);
  return piece(
    size,
    [
      { mask: capsule(butt.x, butt.y, neck.x, neck.y, 1), material: material(ITEM_CHESTNUT, 1.4, 0.4, 0.3) },
      { mask: blob(head.x, head.y, 2.6, 3.4, 0.2, variant + 9), material: material(ITEM_FLINT, 2, 0.5, 0.2, cone) },
    ],
    3,
  );
}

function plot(): Standing {
  const size = 18;
  const foot = middle(size);
  const reach = 7;
  const arm = 3;
  const cord = material(CORD, 1, 0.2, 0.3);
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sy) => ({ x: foot.x + sx * reach, y: foot.y + sy * reach, sx, sy })));
  return piece(
    size,
    corners.flatMap((corner) => [
      { mask: capsule(corner.x, corner.y, corner.x - corner.sx * arm, corner.y, 0.7), material: cord },
      { mask: capsule(corner.x, corner.y, corner.x, corner.y - corner.sy * arm, 0.7), material: cord },
      { mask: blob(corner.x, corner.y, 1.2, 1.2, 0.05, corner.sx * 3 + corner.sy), material: material(WOOD, 1.2, 0.3, 0.3) },
    ]),
    2,
  );
}

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

function hearth(): Standing {
  const size = 24;
  const foot = middle(size);
  const regions: Region[] = [
    { mask: blob(foot.x, foot.y, 6.2, 6.2, 0.1, 31), material: material(CHAR, 0.8, 0.3, 0.4) },
  ];
  for (let i = 0; i < 9; i += 1) {
    const at = polar(foot, (i / 9) * Math.PI * 2 + 0.3, 7.4);
    regions.push({ mask: blob(at.x, at.y, 1.9, 1.7, 0.2, 41 + i), material: material(STONE, 2, 0.5, 0.3) });
  }
  for (let i = 0; i < 3; i += 1) {
    const angle = 0.4 + i * 2.1;
    const near = polar(foot, angle, -4.4);
    const far = polar(foot, angle, 4.4);
    regions.push({ mask: capsule(near.x, near.y, far.x, far.y, 1.1), material: material(WOOD, 1.4, 0.5, 0.4) });
  }
  return piece(size, regions, 3);
}

function burnt(): Standing {
  const size = 24;
  const foot = middle(size);
  const regions: Region[] = [
    { mask: blob(foot.x, foot.y, 6.4, 6.4, 0.2, 33), material: material(STONE, 0.8, 0.3, 0.4) },
    { mask: blob(foot.x, foot.y, 4.4, 4.2, 0.3, 35), material: material(CHAR, 0.8, 0.3, 0.4) },
  ];
  for (let i = 0; i < 9; i += 1) {
    const at = polar(foot, (i / 9) * Math.PI * 2 + 0.3, 7.4);
    regions.push({ mask: blob(at.x, at.y, 1.9, 1.7, 0.2, 41 + i), material: material(STONE, 2, 0.5, 0.3) });
  }
  for (let i = 0; i < 3; i += 1) {
    const angle = 0.9 + i * 2.1;
    const near = polar(foot, angle, -4.2);
    const far = polar(foot, angle, 4.2);
    regions.push({ mask: capsule(near.x, near.y, far.x, far.y, 1), material: material(CHAR, 0.6, 0.4, 0.4) });
  }
  return piece(size, regions, 2);
}

const FLAME_SCALE = [0.38, 0.58, 0.8, 1, 1.28] as const;

const FLAME_BODY = [1, 1, 2, 2, 3] as const;

const FLAME_LEAN = [2, 3, 3, 4, 5] as const;

const FLAME_CORE = [4, 5, 6, 7, 7] as const;

const FLAME_SPARKS = [0, 0, 2, 3, 3] as const;

function blaze(frame: number, tier: number): Standing {
  const size = 16;
  const foot = middle(size);
  const grow = FLAME_SCALE[tier]!;
  const lean = polar(foot, frame * 1.9, 0.9 * grow);
  const regions: Region[] = [
    { mask: blob(foot.x, foot.y, (4.6 + (frame % 2) * 0.5) * grow, (4.2 + (frame % 3) * 0.3) * grow, 0.3, 61 + frame), material: material([FIRE[FLAME_BODY[tier]!]!], 0.5, 0, 0) },
    { mask: blob(lean.x, lean.y, 3.2 * grow, 3 * grow, 0.3, 67 + frame), material: material([FIRE[FLAME_LEAN[tier]!]!], 0.5, 0, 0) },
    { mask: blob(foot.x, foot.y, 1.8 * grow, 1.8 * grow, 0.3, 71 + frame), material: material([FIRE[FLAME_CORE[tier]!]!], 0.5, 0, 0) },
  ];
  for (let i = 0; i < FLAME_SPARKS[tier]!; i += 1) {
    const at = polar(foot, frame * 1.3 + i * 2.2, Math.min(6.4, 5.6 * grow) + ((frame + i) % 2) * 0.8);
    regions.push({ mask: blob(at.x, at.y, 0.6, 0.6, 0.1, 80 + i), material: material([FIRE[5]!], 0.4, 0, 0) });
  }
  return piece(size, regions, 4);
}

export const STACK_STAGES = 5;

const TILE_SIZE = 16;

const PIECES_PER_STAGE: readonly number[] = [1, 5, 9, 14, 20];

const HEAP_RADIUS = 6.2;

const SPIRAL = 2.39996;

type Spot = { x: number; y: number };

type Piece = (at: Spot, reach: number, angle: number, seed: number) => Region[];

const flintPiece: Piece = (at, reach, angle, seed) => {
  const side = polar(at, angle, reach * 0.45);
  return [
    { mask: blob(at.x, at.y, reach * 1.25, reach * 0.8, 0.22, seed), material: material(ITEM_FLINT, 2, 0.5, 0.2, cone) },
    { mask: blob(side.x, side.y, reach * 0.8, reach * 0.55, 0.22, seed + 1), material: material(ITEM_FLINT, 2, 0.5, 0.2, cone) },
  ];
};

const stonePiece: Piece = (at, reach, _angle, seed) => [
  { mask: blob(at.x, at.y, reach, reach * 0.88, 0.3, seed), material: material(ITEM_LIMESTONE, 2.4, 0.4, 0.25, cone) },
];

const kindlingPiece: Piece = (at, reach, angle) =>
  [-1, 0, 1].map((offset, i) => {
    const across = polar(at, angle + Math.PI / 2, offset * reach * 0.6);
    const near = polar(across, angle, -reach);
    const far = polar(across, angle, reach);
    return { mask: capsule(near.x, near.y, far.x, far.y, Math.max(0.85, reach * 0.25 + i * 0.02)), material: material(ITEM_STRAW, 1, 0.3, 0.3) };
  });

const branchPiece: Piece = (at, reach, angle) => {
  const near = polar(at, angle, -reach);
  const far = polar(at, angle, reach);
  const joint = polar(at, angle, reach * 0.15);
  const twig = polar(joint, angle + 0.9, reach * 0.7);
  const bark = material(ITEM_CHESTNUT, 1.4, 0.5, 0.4);
  return [
    { mask: capsule(near.x, near.y, far.x, far.y, Math.max(1.1, reach * 0.34)), material: bark },
    { mask: capsule(joint.x, joint.y, twig.x, twig.y, Math.max(0.85, reach * 0.24)), material: bark },
  ];
};

const torchPiece: Piece = (at, reach, angle, seed) => {
  const near = polar(at, angle, -reach);
  const far = polar(at, angle, reach);
  return [
    { mask: capsule(near.x, near.y, far.x, far.y, Math.max(1.1, reach * 0.34)), material: material(ITEM_CHESTNUT, 1.4, 0.5, 0.4) },
    { mask: blob(far.x, far.y, Math.max(1, reach * 0.4), Math.max(1, reach * 0.4), 0.15, seed), material: material(CHAR, 1.2, 0.5, 0.4) },
  ];
};

function heap(make: Piece, reach: number, stage: number, height: number): Standing {
  const foot = middle(TILE_SIZE);
  const count = PIECES_PER_STAGE[stage]!;
  if (count === 1) return piece(TILE_SIZE, make(foot, reach, 0.4, 3), height);

  const spacing = Math.min(reach * 1.7, (HEAP_RADIUS * 1.15) / Math.sqrt(count));
  const regions: Region[] = [];
  for (let i = 0; i < count; i += 1) {
    const at = polar(foot, i * SPIRAL + stage, spacing * Math.sqrt(i + 0.5));
    regions.push(...make(at, reach, i * 1.7 + stage, stage * 31 + i * 3));
  }
  return piece(TILE_SIZE, regions, height + stage);
}

const STACKING: readonly (readonly [string, Piece, number, number, (variant: number) => Standing])[] = [
  ['flint', flintPiece, 1.9, 3, flint],
  ['stone', stonePiece, 2.7, 4, stone],
  ['kindling', kindlingPiece, 3, 2, kindling],
  ['branch', branchPiece, 3.4, 3, branch],
  ['torch', torchPiece, 3.4, 3, torch],
];

const items = (): LitProp[] => [
  ...STACKING.flatMap(([name, make, reach, height, small]) => [
    lit(`item.${name}.held`, {}, small(0), 1, INKED),
    ...Array.from({ length: STACK_STAGES }, (_, stage) => lit(`item.${name}.s${stage}`, {}, heap(make, reach, stage, height), 1, INKED)),
  ]),
  lit('item.axe.held', {}, axe(0), 1, INKED),
  lit('item.axe.s0', {}, axe(0), 1, INKED),
];

function floorRing(): Standing {
  const size = 18;
  const foot = middle(size);
  const regions: Region[] = [];
  const pebbles = 14;
  for (let i = 0; i < pebbles; i += 1) {
    const angle = (i / pebbles) * Math.PI * 2 + 0.2;
    const at = polar(foot, angle, 7.2 + (i % 3) * 0.3);
    regions.push({ mask: blob(at.x, at.y, 0.9 + (i % 2) * 0.3, 0.8, 0.2, 120 + i), material: material(ITEM_LIMESTONE, 1.6, 0.3, 0.2) });
  }
  return piece(size, regions, 1);
}

export const CLOSE_UP_SOURCES = (): readonly (readonly [string, Standing])[] => [
  ...STACKING.map(([name, make, reach, height]) => [name, heap(make, reach, 0, height)] as const),
  ['axe', axe(0)],
];

export const LIT_FOLK: readonly LitProp[] = [
  ...people(),
  ...items(),
  lit('marker.storage', {}, plot(), 1, STILL),
  lit('marker.floor', {}, floorRing(), 1, STILL),
  lit('marker.plan', {}, plot(), 1, STILL),
  lit('campfire.base', {}, hearth(), 1, STILL),
  lit('campfire.burnt', {}, burnt(), 1, STILL),
  ...Array.from({ length: FLAME_SCALE.length }, (_, tier) => Array.from({ length: 4 }, (_, frame) => lit(`campfire.flame.${tier}.${frame}`, {}, blaze(frame, tier), 1, GLOW))).flat(),
  lit('marker.spark', {}, spark(), 1, GLOW),
  ...Array.from({ length: BREATH_FRAMES }, (_, frame) => lit(`marker.breath.${frame}`, {}, breath(frame), 1, GLOW)),
];
