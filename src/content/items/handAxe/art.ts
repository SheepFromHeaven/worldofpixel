import { lit } from '../../../pixel/ground/objects.ts';
import { INKED } from '../../../pixel/ground/kit.ts';
import type { Art } from '../../art.ts';
import { model } from './model.ts';
import { single } from './sprite.ts';

export const art: Art = {
  sprites: () => [lit('item.axe.held', {}, single(0), 1, INKED), lit('item.axe.s0', {}, single(0), 1, INKED)],
  closeUps: () => [['axe', single(0)]],
  model,
};
