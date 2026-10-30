import { shaders as axolotl } from './species/amphibians/axolotl/index.ts';
import { shaders as aardvark } from './species/mammals/aardvark/index.ts';
import { shaders as human } from './species/people/human/index.ts';
import { shaders as gorilla } from './species/mammals/gorilla/index.ts';
import { shaders as rabbit } from './species/mammals/rabbit/index.ts';
import { shaders as squirrel } from './species/mammals/squirrel/index.ts';
import { shaders as robin } from './species/birds/robin/index.ts';
import { shaders as starling } from './species/birds/starling/index.ts';
import { shaders as bluetit } from './species/birds/bluetit/index.ts';
import { shaders as minnow } from './species/fish/minnow/index.ts';
import { shaders as perch } from './species/fish/perch/index.ts';
import { shaders as carp } from './species/fish/carp/index.ts';
import { shaders as trout } from './species/fish/trout/index.ts';
import { shaders as pike } from './species/fish/pike/index.ts';
import { shaders as herring } from './species/fish/herring/index.ts';
import { shaders as mackerel } from './species/fish/mackerel/index.ts';
import { shaders as flatfish } from './species/fish/flatfish/index.ts';
import { shaders as cod } from './species/fish/cod/index.ts';
import { shaders as tuna } from './species/fish/tuna/index.ts';
import { shaders as aardvarkburrow } from './species/homes/aardvarkburrow/index.ts';
import { shaders as burrow } from './species/homes/burrow/index.ts';
import { shaders as owl } from './species/birds/owl/index.ts';
import { shaders as sparrow } from './species/birds/sparrow/index.ts';
import { shaders as reddeer } from './species/mammals/reddeer/index.ts';
import { shaders as blackbear } from './species/mammals/blackbear/index.ts';
import { shaders as polarbear } from './species/mammals/polarbear/index.ts';
import { shaders as panda } from './species/mammals/panda/index.ts';
import { shaders as brownbear } from './species/mammals/brownbear/index.ts';
import { shaders as roedeer } from './species/mammals/roedeer/index.ts';
import { shaders as fallowdeer } from './species/mammals/fallowdeer/index.ts';
import { shaders as whitetail } from './species/mammals/whitetail/index.ts';
import { shaders as reindeer } from './species/mammals/reindeer/index.ts';
import { shaders as moose } from './species/mammals/moose/index.ts';
import type { AnimalShaders } from './kit/shaders.ts';
import { behaviourOf, groupOf } from './catalogue.ts';
import type { AnimalGroup } from './kit/types.ts';
import { creatureGlsl, profileGlsl } from './kit/system/generate.ts';
import deer from './kit/system/materials/deer.glsl?raw';
import fur from './kit/system/materials/fur.glsl?raw';
import scales from './kit/system/materials/scales.glsl?raw';
import parts from './kit/system/parts.glsl?raw';
import projection from './kit/system/projection.glsl?raw';
import modelCommon from './kit/system/modelCommon.glsl?raw';
import modelMain from './kit/system/modelMain.glsl?raw';

export const ANIMAL_SHADERS: readonly AnimalShaders[] = [aardvark, gorilla, rabbit, reddeer, brownbear, blackbear, polarbear, panda, roedeer, fallowdeer, whitetail, reindeer, moose, squirrel, robin, burrow, aardvarkburrow, owl, minnow, perch, carp, trout, pike, herring, mackerel, flatfish, cod, tuna, sparrow, bluetit, starling, axolotl, human];

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
  'fishProfiles.glsl': [
    ...shadersOf('fish').flatMap((one) => [`#include "${one.key}/profile.glsl"`, `#include "${one.key}/texture.glsl"`]),
    dispatch('fish', 'profileFish', SIGNATURE, ARGUMENTS, (key) => `profile_${key}`, 'profileShadow(p, heading, L)', 'Beast'),
  ].join('\n'),
  'homeProfiles.glsl': [
    ...shadersOf('home').flatMap((one) => [`#include "${one.key}/profile.glsl"`, `#include "${one.key}/texture.glsl"`]),
    dispatch('home', 'profileHome', SIGNATURE, ARGUMENTS, (key) => `profile_${key}`, 'profileShadow(p, heading, L)', 'Beast'),
    dispatch('home', 'homeColour', COLOUR_SIGNATURE, COLOUR_ARGUMENTS, (key) => `texture_${key}`, 'fallback', 'vec3'),
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

export const BIRD_MODES = ['perch', 'hop', 'fly', 'sing', 'look', 'glide'] as const;

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

export const homeProfileOf = (key: string): number => shadersOf('home').findIndex((one) => one.key === key) + 1;
