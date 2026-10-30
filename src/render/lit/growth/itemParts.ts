import type { Limb, Tuft } from './types.ts';

export type Spot = readonly [number, number];

export interface Parts {
  limbs: Limb[];
  tufts: Tuft[];
}

export interface ItemModel {
  readonly reach: number;
  readonly piece?: (parts: Parts, at: Spot, reach: number, angle: number) => void;
  readonly single?: (parts: Parts) => void;
}

export const polar = (from: Spot, angle: number, away: number): Spot => [from[0] + Math.cos(angle) * away, from[1] + Math.sin(angle) * away];

export const stick = (parts: Parts, near: Spot, far: Spot, radius: number, lift = 0.4): void => {
  parts.limbs.push({ from: [near[0], near[1], radius], to: [far[0], far[1], radius + lift], fromRadius: radius, toRadius: radius * 0.9 });
};
