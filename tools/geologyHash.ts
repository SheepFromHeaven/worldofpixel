import { createHash } from 'node:crypto';
import { Geology } from '../src/sim/geology/geology.ts';
import { buildField, riverTiles } from '../src/sim/terrain/worldfield.ts';

const hash = (a: ArrayBufferView): string => createHash('sha1').update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)).digest('hex').slice(0, 10);

for (const seed of (process.env.SEEDS ?? '20250214,7').split(',').map(Number)) {
  const field = buildField(seed);
  const river = riverTiles(field);
  const geology = new Geology({ seed, grid: field.grid, field, river });
  const coarse = geology.coarseFields();
  const probe = createHash('sha1');
  for (let i = 0; i < 60; i += 1) {
    const x = field.grid.x(Math.floor(((i * 7919) % 1000) / 1000 * field.grid.columns));
    const y = field.grid.y(Math.floor(((i * 104729) % 1000) / 1000 * field.grid.rows));
    probe.update(JSON.stringify([geology.column(x, y), geology.tableAt(x, y), geology.surface(x, y)]));
  }
  console.log(`seed ${seed}`, JSON.stringify({
    height: hash(field.height), climate: hash(field.climate), biome: hash(field.biome), fertility: hash(field.fertility),
    features: hash(coarse.features), series: hash(coarse.series), soil: hash(coarse.soil), soilRock: hash(coarse.soilRock), surfaceRock: hash(coarse.surfaceRock),
    probes: probe.digest('hex').slice(0, 10),
  }));
}
