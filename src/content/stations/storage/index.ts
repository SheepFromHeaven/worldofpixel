import { station, ground, storage, unlockedBy } from '../definition.ts';

export const STORAGE = station('storage', 'Storage', 'marker.storage',
  storage({ capacity: 32 }),
  unlockedBy('found'),
  ground({ clears: false, trees: true }),
);
