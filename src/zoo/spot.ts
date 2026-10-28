import { tileSampler } from '../sim/fauna/patches.ts';
import { LIVES, Stage } from '../sim/fauna/life.ts';
import { stageSuitability } from '../sim/fauna/habitat/suitability.ts';
import { Biome } from '../sim/types.ts';
import type { Vec2 } from '../sim/geometry.ts';
import type { World } from '../sim/world.ts';
import type { ZooEntry } from './catalogue.ts';

const SPOT_OFFSETS: readonly number[] = [0, -60, 60, -30, 30];

export function findSpots(world: World, entry: ZooEntry): Vec2[] {
  const scored = SPOT_OFFSETS.map((x, order) => ({ point: { x, y: 0 }, order, score: suitabilityAt(world, entry, { x, y: 0 }) }));
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.filter((one) => one.score > 0).map((one) => one.point);
}

export function suitabilityAt(world: World, entry: ZooEntry, point: Vec2): number {
  const { grid } = world;
  const index = grid.atPoint(point);
  if (index < 0) return 0;
  if (entry.group === 'human') return world.biome[index]! < Biome.Ocean ? 1 : 0;
  return stageSuitability(LIVES[entry.life]!, Stage.Adult, tileSampler(world)(grid.columnOf(index), grid.rowOf(index)));
}
