import { BERRIES, BRANCH, EGG, FIBRE, FISH, FLINT, GRUBS, KINDLING, RABBIT, STONE } from './materials.ts';
import { COOKED, EMBER, FLAME, SPARK } from './fire.ts';
import { BASKET, BINDING, CORD, SHARP, SNARE, SPEAR, TOOL } from './tools.ts';
import { BED, FRAME, HUT, SHELTER } from './shelter.ts';
import type { ResearchDef } from './definition.ts';

export const RESEARCH: readonly ResearchDef[] = [
  FLINT, STONE, KINDLING, BRANCH, SPARK, EMBER, FLAME, SHARP, FIBRE, BINDING, TOOL, BERRIES, GRUBS, EGG, CORD, BASKET, COOKED, FISH, RABBIT, SPEAR, SNARE, FRAME, BED, SHELTER, HUT,
];

const KEYS = new Set(RESEARCH.map((entry) => entry.key));

export const FOUND = 'found';

export const hasResearch = (key: string): boolean => key === FOUND || KEYS.has(key);

export type { ResearchDef };
