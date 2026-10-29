import { HOMES, ITEMS, STRUCTURES, TRAILS } from '../capabilities.ts';
import { provide } from '../kernel/kernel.ts';
import type { World } from '../world.ts';

export const layersOf = (world: World) => [provide(STRUCTURES, world.structures), provide(TRAILS, world.trails), provide(ITEMS, world.items), provide(HOMES, world.homes)];
