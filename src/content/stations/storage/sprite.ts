import type { LitProp } from '../../../pixel/ground/objects.ts';
import { lit } from '../../../pixel/ground/objects.ts';
import { STILL, plot } from '../../../pixel/ground/kit.ts';



export const sprites = (): LitProp[] => [
  lit('marker.storage', {}, plot(), 1, STILL),
];
