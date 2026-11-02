import type { ItemModel, Parts, Spot } from '../../../render/lit/growth/itemParts.ts';

function place(parts: Parts, at: Spot, reach: number): void {
  parts.tufts.push({ at: [at[0], at[1], reach * 0.25], across: reach * 1.2, up: reach * 0.3, tone: 0.4, open: 1 });
}

export const model: ItemModel = { reach: 3, piece: place };
