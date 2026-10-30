import { blurb, footprint, station, needs, shelter, unlockedBy } from '../definition.ts';

export const BED = station('bed', 'Bed', 'structure.bed',
  footprint([[0, 0], [0, 1]]),
  needs(['branch', 2], ['plantFibre', 3]),
  shelter({ recovery: 1.5, loss: 0.75, reach: 'tile' }),
  unlockedBy('bed'),
  blurb('rests half as fast again, off the ground'),
);
