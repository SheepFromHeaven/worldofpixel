import type { Recipe } from './types.js';
import { Channel } from './types.js';

export const Resources = {
  Earth: 'Earth',
  Water: 'Water',
  Air: 'Air',
  Fire: 'Fire',
  Mud: 'Mud',
  ClayBlock: 'Clay Block',
  Steam: 'Steam',
} as const;

export const MUD_RECIPE: Recipe = {
  id: 'mud',
  label: 'Mud',
  inputsRequired: {
    [Channel.Solid]: { [Resources.Earth]: 1 },
    [Channel.Fluid]: { [Resources.Water]: 1 },
  },
  thermalRequirement: 0,
  outputsProduced: {
    [Channel.Solid]: { [Resources.Mud]: 1 },
  },
};

export const CLAY_RECIPE: Recipe = {
  id: 'clay',
  label: 'Clay Block',
  inputsRequired: {
    [Channel.Solid]: { [Resources.Mud]: 1 },
  },
  thermalRequirement: 1,
  outputsProduced: {
    [Channel.Solid]: { [Resources.ClayBlock]: 1 },
  },
};

export const STEAM_RECIPE: Recipe = {
  id: 'steam',
  label: 'Steam',
  inputsRequired: {
    [Channel.Fluid]: { [Resources.Water]: 1 },
  },
  thermalRequirement: 2,
  outputsProduced: {
    [Channel.Gas]: { [Resources.Steam]: 2 },
  },
};

export const CORE_RECIPES: readonly Recipe[] = [MUD_RECIPE, CLAY_RECIPE, STEAM_RECIPE];
