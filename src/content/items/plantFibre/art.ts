import { stackedCloseUp, stackedSprites } from '../../../pixel/ground/kit.ts';
import type { Art } from '../../art.ts';
import { sprite } from './sprite.ts';

export const art: Art = {
  sprites: () => stackedSprites('fibre', sprite),
  closeUps: () => [stackedCloseUp('fibre', sprite)],
};
