import { registerLayer } from '../../sim/layers/registry.ts';
import type { PlantColumns } from './generate.ts';
import { emptyColumns, environmentFor, generatePlants } from './generate.ts';
import { Plants } from './plants.ts';

declare module '../../sim/world.ts' {
  interface World {
    readonly plants: Plants;
  }
}

registerLayer({
  id: 'plants',
  order: 0,
  create: ({ world, generating, saved }) => {
    if (generating) {
      const environment = environmentFor(world.field);
      const { columns, cover } = generatePlants(world.seed, world.field, world.eco, world.damp, world.river, environment);
      world.cover.set(cover);
      const plants = new Plants(world, columns, environment);
      return { layer: plants, exposed: { plants } };
    }
    const own = saved('plants');
    const plants = new Plants(world, own ? (own as unknown as PlantColumns) : emptyColumns(world.grid.count), null);
    return { layer: plants, exposed: { plants } };
  },
});
