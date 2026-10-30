import type { AnimalModel } from './model.ts';

export interface AnimalShaders {
  key: string;
  model: AnimalModel;
  texture: string;
  states: readonly string[];
}
