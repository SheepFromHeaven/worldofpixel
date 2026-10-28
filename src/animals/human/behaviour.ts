import type { AnimalBehaviour } from '../types.ts';
import { compose, forager } from '../archetypes/behaviours.ts';
import { Gait } from '../../sim/mammals/vocabulary.ts';

export const behaviour: AnimalBehaviour = compose(
  forager({ turn: 0.8, shortest: 0.5, longest: 6 }),
  { states: ['walk'] },
  { habits: { gait: Gait.Walk, sight: 1, day: 1, night: 0.2, dusk: 0.5, rest: 4, speed: 1.3, reach: 20, skit: 0 }, hooks: {} },
);
