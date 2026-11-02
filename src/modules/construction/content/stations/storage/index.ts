import { station, ground, storage, needs, fenced, unlockedBy } from '../../../../../content/stations/definition.ts';

export const STORAGE = station('storage', 'Storage', 'item.stone.s2',
  storage({ capacity: 32 }),
  needs(['stone', 4]),
  fenced('stone'),
  unlockedBy('found'),
  ground({ clears: true, trees: false }),
);

export const order = 3;

export default STORAGE;
