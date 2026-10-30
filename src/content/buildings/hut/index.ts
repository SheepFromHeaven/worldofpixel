import { blurb, building, emits, needs, shelter, solid, unlockedBy } from '../definition.ts';

export const HUT = building('hut', 'Hut', 'structure.hut',
  needs(['branch', 5], ['cord', 1], ['plantFibre', 4]),
  solid(),
  shelter({ recovery: 2.2, loss: 0.35, reach: 'adjacent' }),
  emits({ look: 'glow', when: 'occupied', light: { reach: 3.5, strength: 0.55, colour: [1, 0.72, 0.36], flicker: 0.08, windShare: 0, flame: 'none', lift: 0 } }),
  unlockedBy('hut'),
  blurb('rests twice as fast, and keeps the cold off'),
);
