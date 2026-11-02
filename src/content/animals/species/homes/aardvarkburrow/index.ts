import texture from './texture.glsl?raw';
import { HOME_STATES, model } from './model.ts';
import type { AnimalShaders } from '../../../kit/shaders.ts';

export const shaders: AnimalShaders = { key: 'aardvarkburrow', model, texture, states: HOME_STATES };
