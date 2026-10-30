import { registerLayer } from '../../sim/layers/registry.ts';
import { Structures } from './structures.ts';

declare module '../../sim/world.ts' {
  interface World {
    readonly structures: Structures;
  }
}

registerLayer({
  id: 'structures',
  order: 8,
  create: ({ world, column }) => {
    const structures = new Structures(
      { plan: column('structures', 'plan'), built: column('structures', 'built') },
      {
        mark: (tile) => world.mark(tile),
        touch: (tile) => world.touch(tile),
        grid: world.grid,
        cover: world.cover,
        river: world.river,
        wear: world.trails.wear,
        get items() {
          return world.items;
        },
        passable: (tile) => world.movement.passable(tile),
        clearPlants: (tile) => world.plants.clearAll(tile),
      },
    );
    return { layer: structures, exposed: { structures } };
  },
});
