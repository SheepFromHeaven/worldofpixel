import type { AnimalModel } from '../model.ts';
import { bearModel } from '../archetypes/bear.ts';

export const model: AnimalModel = bearModel({ hangs: true });
