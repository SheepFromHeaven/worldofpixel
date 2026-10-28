import { behaviour as aardvarkBehaviour } from './aardvark/behaviour.ts';
import { config as aardvarkConfig } from './aardvark/config.ts';
import { texture as aardvarkTexture } from './aardvark/texture.ts';
import { behaviour as axolotlBehaviour } from './axolotl/behaviour.ts';
import { config as axolotlConfig } from './axolotl/config.ts';
import { texture as axolotlTexture } from './axolotl/texture.ts';
import { model as axolotlModel } from './axolotl/model.ts';
import { behaviour as humanBehaviour } from './human/behaviour.ts';
import { config as humanConfig } from './human/config.ts';
import { texture as humanTexture } from './human/texture.ts';
import { model as humanModel } from './human/model.ts';
import { behaviour as rabbitBehaviour } from './rabbit/behaviour.ts';
import { config as rabbitConfig } from './rabbit/config.ts';
import { texture as rabbitTexture } from './rabbit/texture.ts';
import { behaviour as roedeerBehaviour } from './roedeer/behaviour.ts';
import { config as roedeerConfig } from './roedeer/config.ts';
import { texture as roedeerTexture } from './roedeer/texture.ts';
import { model as roedeerModel } from './roedeer/model.ts';
import { behaviour as fallowdeerBehaviour } from './fallowdeer/behaviour.ts';
import { config as fallowdeerConfig } from './fallowdeer/config.ts';
import { texture as fallowdeerTexture } from './fallowdeer/texture.ts';
import { model as fallowdeerModel } from './fallowdeer/model.ts';
import { behaviour as whitetailBehaviour } from './whitetail/behaviour.ts';
import { config as whitetailConfig } from './whitetail/config.ts';
import { texture as whitetailTexture } from './whitetail/texture.ts';
import { model as whitetailModel } from './whitetail/model.ts';
import { behaviour as reindeerBehaviour } from './reindeer/behaviour.ts';
import { config as reindeerConfig } from './reindeer/config.ts';
import { texture as reindeerTexture } from './reindeer/texture.ts';
import { model as reindeerModel } from './reindeer/model.ts';
import { behaviour as mooseBehaviour } from './moose/behaviour.ts';
import { config as mooseConfig } from './moose/config.ts';
import { texture as mooseTexture } from './moose/texture.ts';
import { model as mooseModel } from './moose/model.ts';
import { behaviour as brownbearBehaviour } from './brownbear/behaviour.ts';
import { config as brownbearConfig } from './brownbear/config.ts';
import { texture as brownbearTexture } from './brownbear/texture.ts';
import { model as brownbearModel } from './brownbear/model.ts';
import { behaviour as blackbearBehaviour } from './blackbear/behaviour.ts';
import { config as blackbearConfig } from './blackbear/config.ts';
import { texture as blackbearTexture } from './blackbear/texture.ts';
import { model as blackbearModel } from './blackbear/model.ts';
import { behaviour as polarbearBehaviour } from './polarbear/behaviour.ts';
import { config as polarbearConfig } from './polarbear/config.ts';
import { texture as polarbearTexture } from './polarbear/texture.ts';
import { model as polarbearModel } from './polarbear/model.ts';
import { behaviour as pandaBehaviour } from './panda/behaviour.ts';
import { config as pandaConfig } from './panda/config.ts';
import { texture as pandaTexture } from './panda/texture.ts';
import { model as pandaModel } from './panda/model.ts';
import { behaviour as reddeerBehaviour } from './reddeer/behaviour.ts';
import { config as reddeerConfig } from './reddeer/config.ts';
import { texture as reddeerTexture } from './reddeer/texture.ts';
import { model as reddeerModel } from './reddeer/model.ts';
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
  { config: reddeerConfig, texture: reddeerTexture, behaviour: reddeerBehaviour },
  { config: blackbearConfig, texture: blackbearTexture, behaviour: blackbearBehaviour },
  { config: polarbearConfig, texture: polarbearTexture, behaviour: polarbearBehaviour },
  { config: pandaConfig, texture: pandaTexture, behaviour: pandaBehaviour },
  { config: brownbearConfig, texture: brownbearTexture, behaviour: brownbearBehaviour },
  { config: roedeerConfig, texture: roedeerTexture, behaviour: roedeerBehaviour },
  { config: fallowdeerConfig, texture: fallowdeerTexture, behaviour: fallowdeerBehaviour },
  { config: whitetailConfig, texture: whitetailTexture, behaviour: whitetailBehaviour },
  { config: reindeerConfig, texture: reindeerTexture, behaviour: reindeerBehaviour },
  { config: mooseConfig, texture: mooseTexture, behaviour: mooseBehaviour },
];

export const VIEW_ONLY: readonly AnimalRecord[] = [
  { config: axolotlConfig, texture: axolotlTexture, behaviour: axolotlBehaviour },
  { config: humanConfig, texture: humanTexture, behaviour: humanBehaviour },
];

export const MIGRATED: ReadonlySet<string> = new Set([...RECORDS, ...VIEW_ONLY].map((record) => record.config.key));

const DRAFTS = new Map<string, Draft>(RECORDS.map((record) => [record.config.key, draftOf(record)]));

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
  ['reddeer', reddeerModel],
  ['blackbear', blackbearModel],
  ['polarbear', polarbearModel],
  ['panda', pandaModel],
  ['brownbear', brownbearModel],
  ['roedeer', roedeerModel],
  ['fallowdeer', fallowdeerModel],
  ['whitetail', whitetailModel],
  ['reindeer', reindeerModel],
  ['moose', mooseModel],
  ['axolotl', axolotlModel],
  ['human', humanModel],
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

export const poseFor = (key: string, state: number, length: number, legs: number, metres: number, going: boolean, since = 0, left = 0, pitch = 0): Pose => {
  const behaviour = BEHAVIOURS.get(key);
  if (!behaviour?.hooks.pose) return NO_POSE;
  const name = statesOf(behaviour)[state] ?? '';
  return behaviour.hooks.pose({ state: name, phase: cycleOf(key, name, length, legs, metres), going, since, left, pitch });
};
