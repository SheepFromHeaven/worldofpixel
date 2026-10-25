export const Cover = {
  Bare: 0,
  Grass: 1,
  Scrub: 2,
  Bush: 3,
  Tree: 4,
  Boulder: 5,
  Fallen: 6,
} as const;

export type Cover = (typeof Cover)[keyof typeof Cover];

export const COVER_NAMES: readonly string[] = [
  'bare ground',
  'grass',
  'scrub',
  'a bush',
  'a tree',
  'a boulder',
  'a fallen tree',
];
