import type { ItemModel, Parts, Spot } from '../../../render/lit/growth/itemParts.ts';
import { polar, stick } from '../../../render/lit/growth/itemParts.ts';

function place(parts: Parts, at: Spot, reach: number, angle: number): void {
  const radius = Math.max(1.1, reach * 0.34);
  const joint = polar(at, angle, reach * 0.15);
  const twig = polar(joint, angle + 0.9, reach * 0.7);
  stick(parts, polar(at, angle, -reach), polar(at, angle, reach), radius, 0.5);
  parts.limbs.push({ from: [joint[0], joint[1], radius], to: [twig[0], twig[1], radius + reach * 0.4], fromRadius: Math.max(0.85, reach * 0.24), toRadius: 0.6 });
}

export const model: ItemModel = { reach: 3.4, piece: place };
