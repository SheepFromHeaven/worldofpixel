import { behaviour } from './behaviour.ts';
import { statesOf } from '../types.ts';
import { fishTexture } from '../archetypes/fish.ts';
import { model } from './model.ts';
import type { AnimalShaders } from '../shaders.ts';

export const shaders: AnimalShaders = { key: 'trout', model, texture: fishTexture('trout'), states: statesOf(behaviour) };
