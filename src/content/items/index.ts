import type { ItemDef } from './definition.ts';
import { item } from './definition.ts';
import { flint } from './flint/index.ts';
import { stone } from './stone/index.ts';
import { dryKindling } from './dryKindling/index.ts';
import { branch } from './branch/index.ts';
import { handAxe } from './handAxe/index.ts';
import { torch } from './torch/index.ts';
import { burningBranch } from './burningBranch/index.ts';
import { plantFibre } from './plantFibre/index.ts';
import { berries } from './berries/index.ts';
import { grubs } from './grubs/index.ts';
import { egg } from './egg/index.ts';
import { cord } from './cord/index.ts';
import { basket } from './basket/index.ts';
import { roast } from './roast/index.ts';
import { fish } from './fish/index.ts';
import { rabbit } from './rabbit/index.ts';
import { hide } from './hide/index.ts';

const NOTHING: ItemDef = item('none', 'nothing', '');

export const ITEMS: readonly ItemDef[] = [NOTHING, flint, stone, dryKindling, branch, handAxe, torch, burningBranch, plantFibre, berries, grubs, egg, cord, basket, roast, fish, rabbit, hide];

const BY_KEY = new Map(ITEMS.map((entry, id) => [entry.key, id]));

export const itemIdOf = (key: string): number => {
  const id = BY_KEY.get(key);
  if (id === undefined) throw new Error(`no item called ${key}`);
  return id;
};

export type { ItemDef };
