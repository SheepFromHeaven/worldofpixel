import { station, ground, job, storage, unlockedBy } from '../definition.ts';

export const KNAPPING_FLOOR = station('knappingFloor', 'Knapping Floor', 'marker.floor',
  storage({ capacity: 12, mixed: true, haul: false }),
  job({ station: 'floor', slots: 1 }),
  ground({ clears: false, trees: true }),
  unlockedBy('tool'),
);
