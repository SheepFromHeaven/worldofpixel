import type { ItemModel, Parts, Spot } from '../../../render/lit/growth/itemParts.ts';
import { polar, stick } from '../../../render/lit/growth/itemParts.ts';

function place(parts: Parts, at: Spot, reach: number, angle: number): void {
  const far = polar(at, angle, reach);
  stick(parts, polar(at, angle, -reach), far, Math.max(1.1, reach * 0.34), 0.5);
  parts.tufts.push({ at: [far[0], far[1], Math.max(1.1, reach * 0.34) + 0.5], across: 1.7, up: 1.6, tone: 0.05, open: 1 });
}

export const model: ItemModel = { reach: 3.4, piece: place };
