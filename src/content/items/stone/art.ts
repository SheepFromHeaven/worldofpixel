import { stackedCloseUp, stackedSprites } from '../../../pixel/ground/kit.ts';
import type { Art } from '../../art.ts';
import { model } from './model.ts';
import { sprite } from './sprite.ts';

export const art: Art = {
  sprites: () => stackedSprites('stone', sprite),
  closeUps: () => [stackedCloseUp('stone', sprite)],
  model,
};
