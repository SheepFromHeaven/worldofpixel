import texture from './texture.glsl?raw';
import { HOME_STATES, model } from './model.ts';
import type { AnimalShaders } from '../shaders.ts';

export const shaders: AnimalShaders = { key: 'burrow', model, texture, states: HOME_STATES };
