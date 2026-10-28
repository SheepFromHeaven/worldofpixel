import { behaviour as aardvarkBehaviour } from './aardvark/behaviour.ts';
import { config as aardvarkConfig } from './aardvark/config.ts';
import { texture as aardvarkTexture } from './aardvark/texture.ts';
import { behaviour as axolotlBehaviour } from './axolotl/behaviour.ts';
import { config as axolotlConfig } from './axolotl/config.ts';
import { texture as axolotlTexture } from './axolotl/texture.ts';
import { model as axolotlModel } from './axolotl/model.ts';
import { behaviour as rabbitBehaviour } from './rabbit/behaviour.ts';
import { config as rabbitConfig } from './rabbit/config.ts';
import { texture as rabbitTexture } from './rabbit/texture.ts';
import { behaviour as gorillaBehaviour } from './gorilla/behaviour.ts';
import { config as gorillaConfig } from './gorilla/config.ts';
import { texture as gorillaTexture } from './gorilla/texture.ts';
import { model as aardvarkModel } from './aardvark/model.ts';
import { model as gorillaModel } from './gorilla/model.ts';
import { model as rabbitModel } from './rabbit/model.ts';
import type { AnimalModel } from './model.ts';
import type { AnimalBehaviour, AnimalRecord, Pose } from './types.ts';
import { draftOf, NO_POSE, statesOf } from './types.ts';
import type { Draft } from '../sim/mammals/vocabulary.ts';

export const RECORDS: readonly AnimalRecord[] = [
  { config: aardvarkConfig, texture: aardvarkTexture, behaviour: aardvarkBehaviour },
  { config: gorillaConfig, texture: gorillaTexture, behaviour: gorillaBehaviour },
  { config: rabbitConfig, texture: rabbitTexture, behaviour: rabbitBehaviour },
];

const DRAFTS = new Map<string, Draft>(RECORDS.map((record) => [record.config.key, draftOf(record)]));

export const VIEW_ONLY: readonly AnimalRecord[] = [{ config: axolotlConfig, texture: axolotlTexture, behaviour: axolotlBehaviour }];

const BEHAVIOURS = new Map<string, AnimalBehaviour>([...RECORDS, ...VIEW_ONLY].map((record) => [record.config.key, record.behaviour]));

export const draftFor = (key: string): Draft => {
  const draft = DRAFTS.get(key);
  if (!draft) throw new Error(`no animal folder for ${key}`);
  return draft;
};

export const behaviourOf = (key: string): AnimalBehaviour | undefined => BEHAVIOURS.get(key);

const MODELS = new Map<string, AnimalModel>([
  ['aardvark', aardvarkModel],
  ['gorilla', gorillaModel],
  ['rabbit', rabbitModel],
  ['axolotl', axolotlModel],
]);

export const modelOf = (key: string): AnimalModel | undefined => MODELS.get(key);

export const strideOf = (key: string, state: string): number => {
  const model = MODELS.get(key);
  return model?.states?.[state]?.stride ?? model?.gait.stride ?? 1;
};

export const cycleOf = (key: string, state: string, length: number, legs: number, metres: number): number => {
  const texels = 3 + 16 * length;
  return ((metres * 16) / Math.max(2, 0.55 * texels * (0.5 + 0.5 * legs) * strideOf(key, state))) * Math.PI * 2;
};

export const poseFor = (key: string, state: number, length: number, legs: number, metres: number, going: boolean, since = 0, left = 0): Pose => {
  const behaviour = BEHAVIOURS.get(key);
  if (!behaviour?.hooks.pose) return NO_POSE;
  const name = statesOf(behaviour)[state] ?? '';
  return behaviour.hooks.pose({ state: name, phase: cycleOf(key, name, length, legs, metres), going, since, left });
};
