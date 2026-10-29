import { GAME_KINDS, GAME_MODULES } from '../sim/modules/index.ts';
import type { Listing, ZooGroup } from '../sim/modules/index.ts';

export type ZooEntry = Listing;

export const GROUPS: readonly { group: ZooGroup; title: string }[] = GAME_KINDS;

const order = (group: ZooGroup): number => GROUPS.findIndex((kind) => kind.group === group);

export const ZOO: readonly ZooEntry[] = GAME_MODULES.flatMap((module) => module.listings).sort((a, b) => order(a.group) - order(b.group));
