import type { ItemModel, Parts, Spot } from '../../../render/lit/growth/itemParts.ts';
import { polar } from '../../../render/lit/growth/itemParts.ts';

function place(parts: Parts, at: Spot, reach: number, angle: number): void {
  const side = polar(at, angle, reach * 0.45);
  parts.tufts.push({ at: [at[0], at[1], reach * 0.6], across: reach * 1.2, up: reach * 0.65, tone: 0.35, open: 1 });
  parts.tufts.push({ at: [side[0], side[1], reach * 0.5], across: reach * 0.8, up: reach * 0.5, tone: 0.5, open: 1 });
}

export const model: ItemModel = { reach: 1.9, piece: place };
