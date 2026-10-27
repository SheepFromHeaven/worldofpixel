import { Water } from '../src/sim/terrain/hydrology.ts';
import { buildField } from '../src/sim/terrain/worldfield.ts';

const field = buildField(Number(process.env.SEED ?? 20250214));
const { grid, water } = field;
const seen = new Uint8Array(grid.count);
const queue = new Int32Array(grid.count);
const sizes: number[] = [];
let land = 0;
let lake = 0;
for (let i = 0; i < grid.count; i += 1) {
  if (water[i] !== Water.Ocean) land += 1;
  if (water[i] === Water.Lake) lake += 1;
}
for (let start = 0; start < grid.count; start += 1) {
  if (water[start] !== Water.Lake || seen[start] === 1) continue;
  let head = 0;
  let tail = 0;
  queue[tail] = start;
  tail += 1;
  seen[start] = 1;
  while (head < tail) {
    const cell = queue[head]!;
    head += 1;
    const column = cell % grid.columns;
    const row = (cell - column) / grid.columns;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const c = column + dx;
      const r = row + dy;
      if (c < 0 || c >= grid.columns || r < 0 || r >= grid.rows) continue;
      const next = r * grid.columns + c;
      if (water[next] !== Water.Lake || seen[next] === 1) continue;
      seen[next] = 1;
      queue[tail] = next;
      tail += 1;
    }
  }
  sizes.push(tail);
}
sizes.sort((a, b) => b - a);
const km2 = (tiles: number): string => (tiles / 1e6).toFixed(3);
console.log(`${(grid.count / 1e6).toFixed(1)}M tiles, land and lakes ${km2(land)} km2, lakes ${km2(lake)} km2 (${((100 * lake) / land).toFixed(1)}% of land incl. lakes), ${sizes.length} lakes`);
console.log(`largest lakes (km2): ${sizes.slice(0, 8).map(km2).join(', ')}; lakes over 0.01 km2: ${sizes.filter((s) => s > 10000).length}; median ${sizes[Math.floor(sizes.length / 2)]} tiles`);
