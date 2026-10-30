import { block, blurb, needs, solid, unlockedBy } from '../../../../../content/stations/definition.ts';

export const WALL = block('wall', 'Wall', 'block.wall',
  needs(['branch', 4], ['cord', 1]),
  solid(),
  unlockedBy('shelter'),
  blurb('stakes lashed together, and nobody walks through'),
);

export const order = 2;

export default WALL;
