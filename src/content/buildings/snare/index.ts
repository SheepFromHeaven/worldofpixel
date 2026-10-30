import { building, needs, trap, unlockedBy } from '../definition.ts';

export const SNARE = building('snare', 'Snare', 'structure.snare',
  needs(['branch', 1], ['cord', 1]),
  trap({ catches: 'rabbit', yields: ['rabbit', 'hide'] }),
  unlockedBy('snare'),
);
