import { shaders as axolotl } from './axolotl/index.ts';
import { shaders as aardvark } from './aardvark/index.ts';
import { shaders as human } from './human/index.ts';
import { shaders as gorilla } from './gorilla/index.ts';
import { shaders as rabbit } from './rabbit/index.ts';
import { shaders as squirrel } from './squirrel/index.ts';
import { shaders as robin } from './robin/index.ts';
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
import { behaviourOf, groupOf } from './catalogue.ts';
import type { AnimalGroup } from './types.ts';
import { creatureGlsl, profileGlsl } from './system/generate.ts';
import deer from './system/materials/deer.glsl?raw';
import fur from './system/materials/fur.glsl?raw';
import scales from './system/materials/scales.glsl?raw';
import parts from './system/parts.glsl?raw';
import projection from './system/projection.glsl?raw';
import modelCommon from './system/modelCommon.glsl?raw';
import modelMain from './system/modelMain.glsl?raw';

export const ANIMAL_SHADERS: readonly AnimalShaders[] = [aardvark, gorilla, rabbit, reddeer, brownbear, blackbear, polarbear, panda, roedeer, fallowdeer, whitetail, reindeer, moose, squirrel, robin, axolotl, human];

export const shadersOf = (group: AnimalGroup): readonly AnimalShaders[] => ANIMAL_SHADERS.filter((one) => groupOf(one.key) === group);

const SIGNATURE = 'vec2 p, float heading, float L, float legs, float tail, float ears, float leg, float moving, float clk, float seed, float posture, float state, vec4 pose, float grow';

const ARGUMENTS = 'p, heading, L, legs, tail, ears, leg, moving, clk, seed, posture, state, pose, grow';

const COLOUR_SIGNATURE = 'float part, float u, vec2 pc, vec3 base, vec3 accent, vec3 fallback, float young, float size';

const COLOUR_ARGUMENTS = 'part, u, pc, base, accent, fallback, young, size';

const dispatch = (group: AnimalGroup, name: string, signature: string, args: string, call: (key: string) => string, fallback: string, returns: string): string =>
  `${returns} ${name}(int id, ${signature}) {\n${shadersOf(group).map((one, index) => `  if (id == ${index + 1}) return ${call(one.key)}(${args});`).join('\n')}\n  return ${fallback};\n}\n`;

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
  ...Object.fromEntries(ANIMAL_SHADERS.flatMap((one) => [[`${one.key}/profile.glsl`, profileGlsl(one.key, one.model, one.states)], [`${one.key}/texture.glsl`, one.texture]])),
  'birdProfiles.glsl': [
    '#include "system/materials/fur.glsl"',
    '#include "system/materials/scales.glsl"',
    ...shadersOf('bird').flatMap((one) => [`#include "${one.key}/profile.glsl"`, `#include "${one.key}/texture.glsl"`]),
    dispatch('bird', 'profileBird', SIGNATURE, ARGUMENTS, (key) => `profile_${key}`, 'profileShadow(p, heading, L)', 'Beast'),
    dispatch('bird', 'birdColour', COLOUR_SIGNATURE, COLOUR_ARGUMENTS, (key) => `texture_${key}`, 'fallback', 'vec3'),
  ].join('\n'),
  'animalProfiles.glsl': [
    '#include "system/materials/fur.glsl"',
    '#include "system/materials/deer.glsl"',
    '#include "system/materials/scales.glsl"',
    ...shadersOf('mammal').flatMap((one) => [`#include "${one.key}/profile.glsl"`, `#include "${one.key}/texture.glsl"`]),
    dispatch('mammal', 'profileBeast', SIGNATURE, ARGUMENTS, (key) => `profile_${key}`, 'profileShadow(p, heading, L)', 'Beast'),
    dispatch('mammal', 'profileColour', COLOUR_SIGNATURE, COLOUR_ARGUMENTS, (key) => `texture_${key}`, 'fallback', 'vec3'),
  ].join('\n'),
});

export const animalIdLibrary = (indexOf: (key: string) => number): string =>
  `int profileIdOf(int sp) {\n${shadersOf('mammal').map((one, index) => `  if (sp == ${indexOf(one.key)}) return ${index + 1};`).join('\n')}\n  return 0;\n}\n`;

export const BIRD_MODES = ['perch', 'hop', 'fly', 'sing'] as const;

const glslVec = (pose: readonly number[]): string => `vec4(${[0, 1, 2, 3].map((at) => (pose[at] ?? 0).toFixed(4)).join(', ')})`;

const poseAt = (key: string, state: string, phase: number): readonly number[] =>
  behaviourOf(key)?.hooks.pose?.({ state, phase, going: true, since: 1, left: 99, pitch: 0 }) ?? [];

export const birdIdLibrary = (indexOf: (key: string) => number): string => {
  const birds = shadersOf('bird');
  const ids = birds.map((one, index) => `  if (sp == ${indexOf(one.key)}) return ${index + 1};`).join('\n');
  const states = birds
    .map((one, index) => `  if (id == ${index + 1}) {\n${BIRD_MODES.map((mode, at) => `    if (mode == ${at}) return ${Math.max(0, one.states.indexOf(mode))}.0;`).join('\n')}\n  }`)
    .join('\n');
  const poses = birds
    .map((one, index) => {
      const lines = BIRD_MODES.map((mode, at) => {
        const rest = poseAt(one.key, mode, 0);
        const beat = poseAt(one.key, mode, Math.PI / 2);
        const swing = [0, 1, 2, 3].map((channel) => (beat[channel] ?? 0) - (rest[channel] ?? 0));
        return `    if (mode == ${at}) return ${glslVec(rest)} + ${glslVec(swing)} * wave;`;
      });
      return `  if (id == ${index + 1}) {\n${lines.join('\n')}\n  }`;
    })
    .join('\n');
  return `int birdProfileIdOf(int sp) {\n${ids}\n  return 0;\n}\n\nfloat birdStateOf(int id, int mode) {\n${states}\n  return 0.0;\n}\n\nvec4 birdPose(int id, int mode, float wave) {\n${poses}\n  return vec4(0.0);\n}\n`;
};
