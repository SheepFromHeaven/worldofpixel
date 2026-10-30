import type { Art } from '../../../../../content/art.ts';
import { bakeTorch, isTorch } from '../../../../../render/lit/growth/torchBake.ts';
import { sprites } from './sprite.ts';

export const art: Art = {
  sprites,
  bakes: [{ match: isTorch, bake: bakeTorch }],
};
