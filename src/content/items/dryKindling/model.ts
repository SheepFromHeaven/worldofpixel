import type { ItemModel, Parts, Spot } from '../../../render/lit/growth/itemParts.ts';
import { polar, stick } from '../../../render/lit/growth/itemParts.ts';

function place(parts: Parts, at: Spot, reach: number, angle: number): void {
  const across = Math.max(0.85, reach * 0.25);
  for (const offset of [-1, 0, 1]) {
    const base = polar(at, angle + Math.PI / 2, offset * reach * 0.6);
    stick(parts, polar(base, angle, -reach), polar(base, angle, reach), across, offset === 0 ? 1.1 : 0.3);
  }
}

export const model: ItemModel = { reach: 3, piece: place };
