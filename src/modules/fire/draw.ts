import type { Drawable } from '../clientSlots.ts';
import { flameTier } from './sources/fuel.ts';

const FLAME_BEAT = 6;

export const hearths: Drawable = {
  id: 'hearths',
  order: 20,
  draw(world, _people, stamp) {
    const { grid, structures } = world;
    if (stamp.has('campfire.burnt')) {
      for (const tile of structures.embers) {
        const at = grid.centre(tile);
        if (stamp.seen(at.x, at.y)) stamp.place('campfire.burnt', at.x, at.y);
      }
    }
    if (!stamp.has('campfire.base')) return;
    for (const tile of structures.fires) {
      const at = grid.centre(tile);
      if (!stamp.seen(at.x, at.y)) continue;
      stamp.place('campfire.base', at.x, at.y);
      if (stamp.grown('campfire.base')) continue;
      stamp.flat(`campfire.flame.${flameTier(structures.fuelAt(tile))}.${Math.floor(stamp.time * FLAME_BEAT + tile * 1.7) % 4}`, at.x, at.y);
    }
  },
};
