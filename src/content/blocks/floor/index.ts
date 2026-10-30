import { block, blurb, needs, unlockedBy } from '../../stations/definition.ts';

export const FLOOR = block('floor', 'Floor', 'block.floor',
  needs(['branch', 3]),
  unlockedBy('frame'),
  blurb('laid branches keep the feet off the ground'),
);
