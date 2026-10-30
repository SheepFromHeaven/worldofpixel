import { building, footprint, storage } from '../definition.ts';

export const STORAGE = building('storage', 'Storage', 'marker.storage',
  storage({ capacity: 32 }),
  footprint({ clears: false, trees: true }),
);
