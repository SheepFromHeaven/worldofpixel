import type { Art } from '../art.ts';
import type { ItemModel } from '../../render/lit/growth/itemParts.ts';
import { art as flint } from './flint/art.ts';
import { art as stone } from './stone/art.ts';
import { art as dryKindling } from './dryKindling/art.ts';
import { art as branch } from './branch/art.ts';
import { art as plantFibre } from './plantFibre/art.ts';
import { art as berries } from './berries/art.ts';
import { art as grubs } from './grubs/art.ts';
import { art as egg } from './egg/art.ts';
import { art as cord } from './cord/art.ts';
import { art as basket } from './basket/art.ts';
import { art as roast } from './roast/art.ts';
import { art as fish } from './fish/art.ts';
import { art as rabbit } from './rabbit/art.ts';
import { art as torch } from './torch/art.ts';
import { art as handAxe } from './handAxe/art.ts';
import { art as hide } from './hide/art.ts';

// each entry: the art key the sprites are named by, and the art
export const ITEM_ARTS: readonly (readonly [string, Art])[] = [
  ['flint', flint],
  ['stone', stone],
  ['kindling', dryKindling],
  ['branch', branch],
  ['fibre', plantFibre],
  ['berries', berries],
  ['grubs', grubs],
  ['egg', egg],
  ['cord', cord],
  ['basket', basket],
  ['roast', roast],
  ['fish', fish],
  ['rabbit', rabbit],
  ['torch', torch],
  ['axe', handAxe],
  ['hide', hide],
];

export const ITEM_MODELS: Readonly<Record<string, ItemModel>> = Object.fromEntries(ITEM_ARTS.flatMap(([name, art]) => (art.model ? [[name, art.model] as const] : [])));
