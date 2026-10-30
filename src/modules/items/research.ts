import { at, research, thing } from '../../content/research/definition.ts';

export const FLINT = research('flint', 'flint', at(1), thing('flint'));
export const STONE = research('stone', 'stone', at(2), thing('stone'));
export const KINDLING = research('kindling', 'dry fibre', at(3), thing('dryKindling'));
export const BRANCH = research('branch', 'branch', at(4), thing('branch'));
export const FIBRE = research('fibre', 'plant fibre', at(9), thing('plantFibre'));
export const BERRIES = research('berries', 'berries', at(12), thing('berries'));
export const GRUBS = research('grubs', 'grubs', at(13), thing('grubs'));
export const EGG = research('egg', 'egg', at(14), thing('egg'));
export const FISH = research('fish', 'fish', at(18), thing('fish'));
export const RABBIT = research('rabbit', 'rabbit', at(19), thing('rabbit'));

export const RESEARCH_ENTRIES = [FLINT, STONE, KINDLING, BRANCH, FIBRE, BERRIES, GRUBS, EGG, FISH, RABBIT];
