import { shaders as axolotl } from './axolotl/index.ts';
import { shaders as aardvark } from './aardvark/index.ts';
import { shaders as human } from './human/index.ts';
import { shaders as gorilla } from './gorilla/index.ts';
import { shaders as rabbit } from './rabbit/index.ts';
import { shaders as reddeer } from './reddeer/index.ts';
import { shaders as blackbear } from './blackbear/index.ts';
import { shaders as polarbear } from './polarbear/index.ts';
import { shaders as panda } from './panda/index.ts';
import { shaders as brownbear } from './brownbear/index.ts';
import { shaders as roedeer } from './roedeer/index.ts';
import { shaders as fallowdeer } from './fallowdeer/index.ts';
import { shaders as whitetail } from './whitetail/index.ts';
import { shaders as reindeer } from './reindeer/index.ts';
import { shaders as moose } from './moose/index.ts';
import type { AnimalShaders } from './shaders.ts';
import { creatureGlsl, profileGlsl } from './system/generate.ts';
import deer from './system/materials/deer.glsl?raw';
import fur from './system/materials/fur.glsl?raw';
import scales from './system/materials/scales.glsl?raw';
import parts from './system/parts.glsl?raw';
import projection from './system/projection.glsl?raw';
import modelCommon from './system/modelCommon.glsl?raw';
import modelMain from './system/modelMain.glsl?raw';

export const ANIMAL_SHADERS: readonly AnimalShaders[] = [aardvark, gorilla, rabbit, reddeer, brownbear, blackbear, polarbear, panda, roedeer, fallowdeer, whitetail, reindeer, moose];

export const VIEW_ONLY_SHADERS: readonly AnimalShaders[] = [axolotl, human];

export const VIEW_SHADERS: readonly AnimalShaders[] = [...ANIMAL_SHADERS, ...VIEW_ONLY_SHADERS];

const SIGNATURE = 'vec2 p, float heading, float L, float legs, float tail, float ears, float leg, float moving, float clk, float seed, float posture, float state, vec4 pose, float grow';

const ARGUMENTS = 'p, heading, L, legs, tail, ears, leg, moving, clk, seed, posture, state, pose, grow';

const COLOUR_SIGNATURE = 'float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size';

const COLOUR_ARGUMENTS = 'part, u, pc, base, accent, fallback, young, size';

const dispatch = (name: string, signature: string, args: string, call: (key: string) => string, fallback: string, returns: string): string =>
  `${returns} ${name}(int id, ${signature}) {\n${ANIMAL_SHADERS.map((one, index) => `  if (id == ${index + 1}) return ${call(one.key)}(${args});`).join('\n')}\n  return ${fallback};\n}\n`;

const VIEW_HEAD = '#version 300 es\nprecision highp float;\n';

export const animalViewShader = (one: AnimalShaders): string =>
  `${VIEW_HEAD}\n#include "system/parts.glsl"\n#include "system/modelCommon.glsl"\n#include "system/materials/fur.glsl"\n#include "system/materials/deer.glsl"\n#include "system/materials/scales.glsl"\n#include "${one.key}/texture.glsl"\n${creatureGlsl(one.key, one.model, one.states)}\n#include "system/modelMain.glsl"\n`;

export const animalLibraries = (): Record<string, string> => ({
  'system/parts.glsl': parts,
  'system/materials/fur.glsl': fur,
  'system/materials/deer.glsl': deer,
  'system/materials/scales.glsl': scales,
  'system/projection.glsl': projection,
  'system/modelCommon.glsl': modelCommon,
  'system/modelMain.glsl': modelMain,
  ...Object.fromEntries(VIEW_ONLY_SHADERS.flatMap((one) => [[`${one.key}/profile.glsl`, profileGlsl(one.key, one.model, one.states)], [`${one.key}/texture.glsl`, one.texture]])),
  ...Object.fromEntries(ANIMAL_SHADERS.flatMap((one) => [[`${one.key}/profile.glsl`, profileGlsl(one.key, one.model, one.states)], [`${one.key}/texture.glsl`, one.texture]])),
  'animalProfiles.glsl': [
    '#include "system/materials/fur.glsl"',
    '#include "system/materials/deer.glsl"',
    '#include "system/materials/scales.glsl"',
    ...ANIMAL_SHADERS.flatMap((one) => [`#include "${one.key}/profile.glsl"`, `#include "${one.key}/texture.glsl"`]),
    dispatch('profileBeast', SIGNATURE, ARGUMENTS, (key) => `profile_${key}`, 'profileShadow(p, heading, L)', 'Beast'),
    dispatch('profileColour', COLOUR_SIGNATURE, COLOUR_ARGUMENTS, (key) => `texture_${key}`, 'fallback', 'vec3'),
  ].join('\n'),
});

export const animalIdLibrary = (indexOf: (key: string) => number): string =>
  `int profileIdOf(int sp) {\n${ANIMAL_SHADERS.map((one, index) => `  if (sp == ${indexOf(one.key)}) return ${index + 1};`).join('\n')}\n  return 0;\n}\n`;
