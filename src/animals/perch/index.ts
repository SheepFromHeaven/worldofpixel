import { behaviour } from './behaviour.ts';
import { statesOf } from '../types.ts';
import { fishTexture } from '../archetypes/fish.ts';
import { model } from './model.ts';
import type { AnimalShaders } from '../shaders.ts';

export const shaders: AnimalShaders = { key: 'perch', model, texture: fishTexture('perch'), states: statesOf(behaviour) };
