import type { Art } from '../../../../../content/art.ts';
import { bakeCampfire, isCampfire } from '../../../../../render/lit/growth/campfireBake.ts';
import { sprites } from './sprite.ts';

export const art: Art = {
  sprites,
  bakes: [{ match: isCampfire, bake: bakeCampfire }],
};
