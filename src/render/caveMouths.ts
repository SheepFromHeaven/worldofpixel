import { Cave } from '../sim/geology/caves.ts';
import { geologyOf } from '../sim/geology/geology.ts';
import type { Sample } from '../sim/geology/geology.ts';
import { noise2 } from '../sim/rng.ts';
import { isWater } from '../sim/terrain/worldfield.ts';
import type { Biome } from '../sim/types.ts';
import type { World } from '../sim/world.ts';

const BLOCK = 32;
const PROBE_METRES = 1.5;
const REACH = 1.3;

const blocks = new WeakMap<World, Map<number, Uint8Array>>();
const probe: Sample = { rock: 0, mineral: 0, cave: 0, above: 0, life: 0 };

function block(world: World, bx: number, by: number): Uint8Array {
  let cache = blocks.get(world);
  if (!cache) {
    cache = new Map();
    blocks.set(world, cache);
  }
  const key = by * 4096 + bx;
  const kept = cache.get(key);
  if (kept) return kept;

  const { grid } = world;
  const geology = geologyOf(world);
  const out = new Uint8Array(BLOCK * BLOCK);
  for (let dy = 0; dy < BLOCK; dy += 1) {
    for (let dx = 0; dx < BLOCK; dx += 1) {
      const column = bx * BLOCK + dx;
      const row = by * BLOCK + dy;
      if (!grid.holds(column, row)) continue;
      const index = row * grid.columns + column;
      if (isWater(world.biome[index] as Biome)) continue;
      const x = grid.minX + (column + 0.5) * grid.spacing;
      const y = grid.minY + (row + 0.5) * grid.spacing;
      const here = geology.groundAt(x, y);
      if (here <= 0) continue;
      geology.sampleBelow(x, y, PROBE_METRES, probe);
      if (probe.cave !== Cave.Open && probe.cave !== Cave.Dripstone) continue;
      out[dy * BLOCK + dx] = 1;
    }
  }
  cache.set(key, out);
  return out;
}

const open = (world: World, column: number, row: number): boolean => {
  if (!world.grid.holds(column, row)) return false;
  return block(world, Math.floor(column / BLOCK), Math.floor(row / BLOCK))[(row % BLOCK) * BLOCK + (column % BLOCK)] === 1;
};

export function mouthAt(world: World, x: number, y: number): number {
  const { grid } = world;
  const px = (x - grid.minX) / grid.spacing;
  const py = (y - grid.minY) / grid.spacing;
  const column = Math.floor(px);
  const row = Math.floor(py);
  let field = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!open(world, column + dx, row + dy)) continue;
      const distance = Math.hypot(column + dx + 0.5 - px, row + dy + 0.5 - py);
      field = Math.max(field, 1 - distance / REACH);
    }
  }
  if (field <= 0) return 0;
  const wobble = (noise2(px * 1.7, py * 1.7, world.seed + 2203) - 0.5) * 0.5;
  const depth = field + wobble * Math.min(1, field * 3) - 0.28;
  return depth;
}
