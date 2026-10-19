import type { Sprite } from '../sprite.ts';
import { dig } from './dig.ts';
import { hearth } from './hearth.ts';
import { well } from './well.ts';
import { villager } from './villager.ts';

/** Every sprite the game ships. `npm run sprites` bakes each one into `public/tiles`. */
export const SPRITES: readonly Sprite[] = [dig, well, hearth, villager];
