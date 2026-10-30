import { block, blurb, needs, solid, unlockedBy } from '../../stations/definition.ts';

export const WALL = block('wall', 'Wall', 'block.wall',
  needs(['branch', 4], ['cord', 1]),
  solid(),
  unlockedBy('shelter'),
  blurb('stakes lashed together, and nobody walks through'),
);
