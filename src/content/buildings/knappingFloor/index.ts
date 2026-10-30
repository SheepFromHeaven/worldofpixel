import { building, footprint, job, storage, unlockedBy } from '../definition.ts';

export const KNAPPING_FLOOR = building('knappingFloor', 'Knapping Floor', 'marker.floor',
  storage({ capacity: 12, mixed: true, haul: false }),
  job({ station: 'floor', slots: 1 }),
  footprint({ clears: false, trees: true }),
  unlockedBy('tool'),
);
