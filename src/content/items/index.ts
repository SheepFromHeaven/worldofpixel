import type { ItemDef } from './definition.ts';
import { item } from './definition.ts';
import { ITEM_DEFS } from './manifest.generated.ts';

const NOTHING: ItemDef = item('none', 'nothing', '');

export const ITEMS: readonly ItemDef[] = [NOTHING, ...ITEM_DEFS];

const BY_KEY = new Map(ITEMS.map((entry, id) => [entry.key, id]));

export const itemIdOf = (key: string): number => {
  const id = BY_KEY.get(key);
  if (id === undefined) throw new Error(`no item called ${key}`);
  return id;
};

export type { ItemDef };
