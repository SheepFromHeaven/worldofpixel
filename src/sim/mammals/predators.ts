import { lifeOf } from '../fauna/life.ts';
import { MAMMALS } from './species.ts';

export const PREDATOR_MIN_KG = 15;

export const PREDATOR_MIN_LENGTH = 0.9;

export const PREDATORS: readonly number[] = MAMMALS.flatMap((species, index) => {
  const life = lifeOf(species.key);
  return life.plant[2]! < 0.3 && life.mass[3]! >= PREDATOR_MIN_KG && species.length >= PREDATOR_MIN_LENGTH ? [index] : [];
});

export const PREDATOR_COUNT = Math.max(1, PREDATORS.length);
