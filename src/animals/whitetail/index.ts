import texture from './texture.glsl?raw';
import { behaviour } from './behaviour.ts';
import { statesOf } from '../types.ts';
import { model } from './model.ts';
import type { AnimalShaders } from '../shaders.ts';

export const shaders: AnimalShaders = { key: 'whitetail', model, texture, states: statesOf(behaviour) };
