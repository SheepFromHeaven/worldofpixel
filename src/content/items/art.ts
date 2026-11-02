import type { Art } from '../art.ts';
import type { ItemModel } from '../../render/lit/growth/itemParts.ts';
import { ITEM_ART_LIST } from './art.manifest.generated.ts';

export const ITEM_ARTS: readonly (readonly [string, Art])[] = ITEM_ART_LIST;

export const ITEM_MODELS: Readonly<Record<string, ItemModel>> = Object.fromEntries(ITEM_ARTS.flatMap(([name, art]) => (art.model ? [[name, art.model] as const] : [])));
