import { STRUCTURES } from '../../modules/construction/api.ts';
import { TRAILS } from '../../modules/trails/api.ts';
import { provide } from '../kernel/kernel.ts';
import type { World } from '../world.ts';

export const layersOf = (world: World) => [provide(STRUCTURES, world.structures), provide(TRAILS, world.trails)];
