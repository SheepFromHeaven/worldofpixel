import { behaviour } from './behaviour.ts';
import { statesOf } from '../../../kit/types.ts';
import { fishTexture } from '../../../kit/archetypes/fish.ts';
import { model } from './model.ts';
import type { AnimalShaders } from '../../../kit/shaders.ts';

export const shaders: AnimalShaders = { key: 'herring', model, texture: fishTexture('herring'), states: statesOf(behaviour) };
