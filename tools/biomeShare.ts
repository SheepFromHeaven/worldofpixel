import { buildCoarse } from '../src/sim/terrain/coarse.ts';
import { classify, altitudeOf } from '../src/sim/terrain/climate.ts';
import { Water } from '../src/sim/terrain/hydrology.ts';
import { BIOME_NAMES } from '../src/sim/types.ts';
const c = buildCoarse(Number(process.env.SEED ?? 5), 8);
const n: Record<string, number> = {}; let land = 0; let alt = 0; let wet = 0; let temp = 0;
for (let i = 0; i < c.grid.count; i += 1) { if (c.flow.water[i] !== Water.None) continue; land += 1; const b = BIOME_NAMES[classify(c.height[i]!, c.temperature[i]!, c.wet[i]!, false)]!; n[b] = (n[b] ?? 0) + 1; alt += altitudeOf(c.height[i]!); wet += c.wet[i]!; temp += c.temperature[i]!; }
console.log(Object.entries(n).map(([k, v]) => `${k} ${(100 * v / land).toFixed(0)}%`).join(', '), `mean alt ${(alt/land).toFixed(2)} wet ${(wet/land).toFixed(1)} temp ${(temp/land).toFixed(1)}`);
