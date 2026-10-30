import type { AnimalModel } from '../../../kit/model.ts';
import { bearModel } from '../../../kit/archetypes/bear.ts';

export const model: AnimalModel = bearModel({ hangs: 1 });
