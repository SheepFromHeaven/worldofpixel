import type { ItemModel, Parts, Spot } from '../../../render/lit/growth/itemParts.ts';

function place(parts: Parts, at: Spot, reach: number): void {
  parts.tufts.push({ at: [at[0], at[1], reach * 0.7], across: reach * 0.95, up: reach * 0.75, tone: 0.5, open: 1 });
}

export const model: ItemModel = { reach: 2.7, piece: place };
