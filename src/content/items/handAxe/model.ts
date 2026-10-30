import type { ItemModel, Parts } from '../../../render/lit/growth/itemParts.ts';
import { polar } from '../../../render/lit/growth/itemParts.ts';

function place(parts: Parts): void {
  const angle = -0.5;
  const butt = polar([0, 0], angle, -6);
  const neck = polar([0, 0], angle, 4);
  const head = polar([0, 0], angle, 5);
  parts.limbs.push({ from: [butt[0], butt[1], 1], to: [neck[0], neck[1], 1.5], fromRadius: 1, toRadius: 1 });
  parts.tufts.push({ at: [head[0], head[1], 2], across: 2.6, up: 2.2, tone: 0.1, open: 1 });
}

export const model: ItemModel = { reach: 0, single: place };
