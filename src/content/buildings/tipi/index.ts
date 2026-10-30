import { blurb, building, emits, needs, shelter, solid, unlockedBy } from '../definition.ts';

export const TIPI = building('tipi', 'Tipi', 'structure.tipi',
  needs(['hide', 4], ['branch', 6], ['cord', 2]),
  solid(),
  shelter({ recovery: 2.6, loss: 0.3, reach: 'adjacent' }),
  emits({ look: 'glow', when: 'occupied', light: { reach: 3.5, strength: 0.55, colour: [1, 0.72, 0.36], flicker: 0.08, windShare: 0, flame: 'none', lift: 0 } }),
  unlockedBy('hut'),
  blurb('rests more than twice as fast, and keeps the cold and the wind off'),
);
