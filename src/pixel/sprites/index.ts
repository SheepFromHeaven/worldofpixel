import type { Sprite } from '../sprite.ts';
import { borderStone } from './borderStone.ts';
import { dig } from './dig.ts';
import { hearth } from './hearth.ts';
import { well } from './well.ts';
import { woodcutter } from './woodcutter.ts';
import { villagerMan, villagerWoman } from './villager.ts';

/** Every sprite the game ships. `npm run sprites` bakes each one into `public/tiles`. */
export const SPRITES: readonly Sprite[] = [dig, well, woodcutter, hearth, villagerWoman, villagerMan, borderStone];
