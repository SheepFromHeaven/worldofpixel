import { Geology } from '../src/sim/geology/geology.ts';
import { TileGrid } from '../src/sim/grid.ts';
import { moisture, temperatures } from '../src/sim/terrain/climate.ts';
import type { CoarseField } from '../src/sim/terrain/coarse.ts';
import { baseHeights } from '../src/sim/terrain/heightmap.ts';
import { accumulate, dryLakes, resolveFlow, rumpled, traceRivers } from '../src/sim/terrain/hydrology.ts';
import type { RiverNetwork } from '../src/sim/terrain/riverNetwork.ts';
import { carveRivers, lendFlux } from '../src/sim/terrain/riverNetwork.ts';
import { surfaceBiomes } from '../src/sim/terrain/surface.ts';
import { coarseOcean, rainOver } from '../src/sim/terrain/window.ts';
import { classifyAll, riverTiles, wanderEdges } from '../src/sim/terrain/worldfield.ts';

export interface Truth {
  grid: TileGrid;
  water: Uint8Array;
  flux: Float32Array;
  river: Uint8Array;
  climate: Uint8Array;
  biome: Uint8Array;
  fertility: Uint8Array | null;
  geology: Geology | null;
}

export function truthFrom(field: CoarseField, network: RiverNetwork | null, seed: number): Truth {
  const grid = TileGrid.world(1);
  const terrain = baseHeights(grid, seed);
  const sea = coarseOcean(field, grid, rumpled(grid, terrain, seed), { column: 0, row: 0 });
  if (network) carveRivers(network, grid, terrain);
  const flow = resolveFlow(grid, rumpled(grid, terrain, seed), { ocean: sea, level: new Float32Array(grid.count).fill(NaN) });
  const temperature = temperatures(grid, terrain, field.latitudes);
  const rain = rainOver(field, grid);
  let flux = accumulate(flow, rain);
  for (let round = 0; round < 3; round += 1) {
    if (dryLakes(grid, flow, flux, temperature) === 0) break;
    flux = accumulate(flow, rain);
  }
  if (network) lendFlux(network, grid, flux);
  const rivers = traceRivers(grid, flow, flux, seed);
  const wet = moisture(grid, rain, flow.water, rivers.of, flux);
  const climate = wanderEdges(grid, classifyAll(grid, flow.water, terrain, temperature, wet, rivers.of), seed);
  const river = new Uint8Array(grid.count);
  for (let i = 0; i < grid.count; i += 1) if (rivers.of[i] !== 0) river[i] = 1;
  const banks = riverTiles({ grid, rivers });
  const geology = new Geology({ seed: seed, grid, field: { height: terrain, wet, temperature, climate, water: flow.water, surface: flow.filled }, river: banks }, { top: field.top });
  const surface = surfaceBiomes({ seed: seed, grid, climate, height: terrain }, geology, banks);
  return { grid, water: flow.water, flux, river, climate, biome: surface.biome, fertility: surface.fertility, geology };
}
