import type { Ramp } from '../color.ts';
import { BIRCH, CHESTNUT, FOLIAGE, JUNGLE, OLIVE, PALM } from '../palette.ts';
import type { Material } from '../shade.ts';
import type { Decal } from './decals.ts';
import type { Standing, Traits } from './objects.ts';
import { acacia, bareCrown, boulder, bush, fronds, lit, oak, pine, snag, stand, STOREYS, willow } from './objects.ts';
import type { LitProp } from './objects.ts';

type Make = (scale: number, variant: number) => Standing;

export interface TreeArt {
  name: string;
  variants: number;
  make: Make;
  bare: boolean;
  trunk: number;
}

const leaves = (ramp: Ramp): Material => ({ ramp, relief: 4, ambient: 0.1, contrast: 0.85, speckle: 0.35 });

const pick = (sizes: readonly number[], variant: number): number => sizes[variant % sizes.length]!;

export const TREE_ARTS: readonly TreeArt[] = [
  { name: 'oak', variants: 3, bare: true, trunk: 4, make: (s, v) => oak(pick([28, 32, 36], v) * s, 301 + 97 * v) },
  {
    name: 'birch',
    variants: 2,
    bare: true,
    trunk: 2.6,
    make: (s, v) => oak(pick([20, 23], v) * s, 601 + 97 * v, { leaves: leaves(BIRCH), kinds: [0, 3], lobes: 7, lobe: 0.8, reach: 0.9, fringe: 1, tufts: 2 }),
  },
  {
    name: 'chestnut',
    variants: 2,
    bare: true,
    trunk: 4.6,
    make: (s, v) => oak(pick([32, 36], v) * s, 641 + 97 * v, { leaves: leaves(CHESTNUT), kinds: [0, 2], lobes: 10, lobe: 1.05, fringe: 0.35 }),
  },
  {
    name: 'apple',
    variants: 2,
    bare: true,
    trunk: 3,
    make: (s, v) => oak(pick([16, 18], v) * s, 681 + 97 * v, { kinds: [0, 1], lobes: 7, squat: 0.8, fringe: 0.5 }),
  },
  { name: 'willow', variants: 2, bare: true, trunk: 3.6, make: (s, v) => willow(pick([24, 28], v) * s, 541 + 97 * v) },
  { name: 'pine', variants: 3, bare: false, trunk: 2.8, make: (s, v) => pine(pick([14, 16, 11], v) * s, 401 + 97 * v, false) },
  { name: 'snowpine', variants: 2, bare: false, trunk: 2.8, make: (s, v) => pine(pick([14, 11], v) * s, 449 + 97 * v, true) },
  {
    name: 'spruce',
    variants: 2,
    bare: false,
    trunk: 2.8,
    make: (s, v) => pine(pick([13, 15], v) * s, 701 + 97 * v, false, { tiers: 4, broad: 0.75, spray: 9 }),
  },
  {
    name: 'cypress',
    variants: 2,
    bare: false,
    trunk: 2.2,
    make: (s, v) => pine(pick([9, 11], v) * s, 741 + 97 * v, false, { ramp: JUNGLE, tiers: 3, broad: 0.55, spray: 7 }),
  },
  {
    name: 'olive',
    variants: 2,
    bare: false,
    trunk: 3.2,
    make: (s, v) => oak(pick([18, 20], v) * s, 781 + 97 * v, { leaves: leaves(OLIVE), kinds: [1, 2, 3], lobes: 7, lobe: 0.85, fringe: 1.1, squat: 0.8 }),
  },
  { name: 'acacia', variants: 3, bare: false, trunk: 3.2, make: (s, v) => acacia(30 * s, 503 + 97 * v) },
  {
    name: 'baobab',
    variants: 2,
    bare: false,
    trunk: 5.5,
    make: (s, v) => acacia(pick([34, 38], v) * s, 821 + 97 * v, { ramp: OLIVE, lobes: 3, rise: 0.7, fringe: 1.3 }),
  },
  {
    name: 'palm',
    variants: 3,
    bare: false,
    trunk: 2.2,
    make: (s, v) => fronds(pick([22, 25, 28], v) * s, 861 + 97 * v, { ramp: PALM, count: 9, from: 0.08, to: 0.95, width: 0.13, rise: 0.5, feather: 0.2 }),
  },
  {
    name: 'kapok',
    variants: 2,
    bare: false,
    trunk: 5.2,
    make: (s, v) => acacia(pick([42, 46], v) * s, 901 + 97 * v, { ramp: JUNGLE, lobes: 7, rise: 1.1, fringe: 0.5 }),
  },
  {
    name: 'jungle',
    variants: 2,
    bare: false,
    trunk: 4.4,
    make: (s, v) => oak(pick([34, 38], v) * s, 941 + 97 * v, { leaves: leaves(JUNGLE), kinds: [0, 1, 2], lobes: 11, lobe: 1.1, fringe: 0.3 }),
  },
  {
    name: 'fig',
    variants: 2,
    bare: false,
    trunk: 4.4,
    make: (s, v) => oak(pick([30, 33], v) * s, 981 + 97 * v, { leaves: leaves(FOLIAGE), kinds: [0, 2], lobes: 9, lobe: 1.15, fringe: 0.4 }),
  },
  { name: 'snag', variants: 3, bare: false, trunk: 0, make: (s, v) => snag(14 * s, 521 + 97 * v) },
];

const TREE_TRAITS: Traits = { sway: 1, canopy: true, bend: false, torchShadow: true };

export const LIT_TREES: readonly LitProp[] = TREE_ARTS.flatMap((art) =>
  Array.from({ length: art.variants }, (_, variant) =>
    STOREYS.map((storey) => lit(`tree.${art.name}.v${variant}.${storey.name}`, {}, art.make(storey.scale, variant), storey.tall, TREE_TRAITS)),
  ).flat(),
);

export const LIT_BARE: readonly LitProp[] = TREE_ARTS.filter((art) => art.bare).flatMap((art) =>
  Array.from({ length: art.variants }, (_, variant) =>
    STOREYS.map((storey) =>
      lit(
        `bare.${art.name}.v${variant}.${storey.name}`,
        {},
        bareCrown(art.make(storey.scale, variant), 400 + variant * 53 + art.name.length),
        storey.tall,
        { sway: 0, canopy: false, bend: false, hides: true, torchShadow: true },
      ),
    ),
  ).flat(),
);

export const OBJECTS: readonly Decal[] = [
  ...TREE_ARTS.map((art) => stand(`tree.${art.name}`, {}, art.make(1, 0))),
  stand('bush.shrub', {}, bush(6, 601, false)),
  stand('bush.berry', {}, bush(6, 627, true)),
  stand('boulder.1', { highland: 0.15, meadow: 0.02 }, boulder(7, 701, 'bare')),
  stand('boulder.2', { highland: 0.12, desert: 0.04 }, boulder(5, 719, 'bare')),
  stand('boulder.lichen', { highland: 0.1, tundra: 0.08 }, boulder(6, 733, 'lichen')),
  stand('boulder.snow', { tundra: 0.1 }, boulder(7, 751, 'snow')),
];
