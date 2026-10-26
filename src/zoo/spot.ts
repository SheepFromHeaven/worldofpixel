import { tileSampler } from '../sim/fauna/patches.ts';
import { LIVES, Stage } from '../sim/fauna/life.ts';
import { stageSuitability } from '../sim/fauna/habitat/suitability.ts';
import type { Vec2 } from '../sim/geometry.ts';
import type { World } from '../sim/world.ts';
import type { ZooEntry } from './catalogue.ts';

const STRIDE = 8;

const FINALISTS = 160;

const REACH = 4;

const SPACING = 48;

const SPOTS = 12;

export function findSpots(world: World, entry: ZooEntry): Vec2[] {
  const { grid } = world;
  const sample = tileSampler(world);
  const life = LIVES[entry.life]!;
  const suit = (column: number, row: number): number => stageSuitability(life, Stage.Adult, sample(column, row));

  const coarse: { column: number; row: number; score: number }[] = [];
  for (let row = 0; row < grid.rows; row += STRIDE) {
    for (let column = 0; column < grid.columns; column += STRIDE) {
      const score = suit(column, row);
      if (score > 0) coarse.push({ column, row, score });
    }
  }
  coarse.sort((a, b) => b.score - a.score || a.row - b.row || a.column - b.column);

  const refined = coarse.slice(0, FINALISTS).map(({ column, row }) => {
    let sum = 0;
    for (let dr = -REACH; dr <= REACH; dr += 2) {
      for (let dc = -REACH; dc <= REACH; dc += 2) {
        sum += suit(Math.min(grid.columns - 1, Math.max(0, column + dc)), Math.min(grid.rows - 1, Math.max(0, row + dr)));
      }
    }
    return { column, row, score: sum };
  });
  refined.sort((a, b) => b.score - a.score || a.row - b.row || a.column - b.column);

  const kept: { column: number; row: number }[] = [];
  for (const candidate of refined) {
    if (kept.length >= SPOTS) break;
    if (kept.every((other) => Math.hypot(other.column - candidate.column, other.row - candidate.row) > SPACING)) kept.push(candidate);
  }
  return kept.map(({ column, row }) => ({ x: grid.x(column), y: grid.y(row) }));
}

export function suitabilityAt(world: World, entry: ZooEntry, point: Vec2): number {
  const { grid } = world;
  const index = grid.atPoint(point);
  if (index < 0) return 0;
  return stageSuitability(LIVES[entry.life]!, Stage.Adult, tileSampler(world)(grid.columnOf(index), grid.rowOf(index)));
}
