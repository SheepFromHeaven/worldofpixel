import type { AnimalBehaviour } from '../types.ts';
import { compose, forager } from '../archetypes/behaviours.ts';
import { Gait } from '../../sim/mammals/vocabulary.ts';

export const behaviour: AnimalBehaviour = compose(
  forager({ turn: 0.8, shortest: 0.1, longest: 0.4 }),
  { states: ['walk'] },
  { habits: { gait: Gait.Walk, sight: 1, day: 0.5, night: 0.9, dusk: 0.8, rest: 20, speed: 0.1, reach: 6, skit: 2 }, hooks: {} },
);
