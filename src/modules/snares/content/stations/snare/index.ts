import { station, needs, trap, unlockedBy } from '../../../../../content/stations/definition.ts';

export const SNARE = station('snare', 'Snare', 'structure.snare',
  needs(['branch', 1], ['cord', 1]),
  trap({ catches: 'rabbit', yields: ['rabbit', 'hide'] }),
  unlockedBy('snare'),
);

export const order = 2;

export default SNARE;
