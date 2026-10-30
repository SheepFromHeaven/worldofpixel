import { RESEARCH_LISTS } from './manifest.generated.ts';
import type { ResearchDef } from './definition.ts';

export const RESEARCH: readonly ResearchDef[] = RESEARCH_LISTS.flat().sort((a, b) => a.order - b.order);

for (let i = 1; i < RESEARCH.length; i += 1) if (RESEARCH[i]!.order === RESEARCH[i - 1]!.order) throw new Error(`${RESEARCH[i - 1]!.key} and ${RESEARCH[i]!.key} share research order ${RESEARCH[i]!.order}`);

const KEYS = new Set(RESEARCH.map((entry) => entry.key));

export const FOUND = 'found';

export const hasResearch = (key: string): boolean => key === FOUND || KEYS.has(key);

export type { ResearchDef };
