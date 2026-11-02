import type { LitProp, Standing } from '../pixel/ground/objects.ts';
import type { ItemModel } from '../render/lit/growth/itemParts.ts';
import type { Baked, Sheets } from '../render/lit/obliqueCanvas.ts';
import type { SpriteSheetEntry } from '../render/lit/propPlacementCache.ts';

export interface Bake {
  match(name: string): boolean;
  bake(sheets: Sheets, entry: SpriteSheetEntry): Baked;
}

export interface Art {
  readonly sprites?: () => readonly LitProp[];
  readonly closeUps?: () => readonly (readonly [string, Standing])[];
  readonly model?: ItemModel;
  readonly bakes?: readonly Bake[];
}
