import { registerLayer } from '../../sim/layers/registry.ts';
import { Trails } from './trails.ts';

declare module '../../sim/world.ts' {
  interface World {
    readonly trails: Trails;
  }
}

registerLayer({
  id: 'trails',
  order: 5,
  create: ({ world, column }) => {
    const trails = new Trails(column('trails', 'wear'), {
      mark: (tile) => world.mark(tile),
      touch: (tile) => world.touch(tile),
      cover: world.cover,
      trample: (tile) => world.plants.trample(tile),
      held: (tile) => world.heldFast(tile),
    });
    return { layer: trails, exposed: { trails } };
  },
});
