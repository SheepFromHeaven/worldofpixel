import type { TileIndex } from '../grid.ts';
import { AROUND, NOWHERE } from '../grid.ts';
import type { World } from '../world.ts';

export const PATH_LIMIT = 192;

const MAX_EXPANSIONS = 6000;

const HASTE = 1.4;

const CHEAPEST_STEP = 0.85;

const DIAGONAL = Math.SQRT2;

class MinHeap {
  private readonly keys: number[] = [];
  private readonly nodes: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(key: number, node: number): void {
    let at = this.nodes.length;
    this.keys.push(key);
    this.nodes.push(node);
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (this.keys[parent]! <= key) break;
      this.keys[at] = this.keys[parent]!;
      this.nodes[at] = this.nodes[parent]!;
      at = parent;
    }
    this.keys[at] = key;
    this.nodes[at] = node;
  }

  pop(): number {
    const top = this.nodes[0]!;
    const key = this.keys.pop()!;
    const node = this.nodes.pop()!;
    const size = this.nodes.length;
    if (size === 0) return top;

    let at = 0;
    for (;;) {
      let child = at * 2 + 1;
      if (child >= size) break;
      if (child + 1 < size && this.keys[child + 1]! < this.keys[child]!) child += 1;
      if (this.keys[child]! >= key) break;
      this.keys[at] = this.keys[child]!;
      this.nodes[at] = this.nodes[child]!;
      at = child;
    }
    this.keys[at] = key;
    this.nodes[at] = node;
    return top;
  }
}

export function findPath(world: World, from: TileIndex, goal: TileIndex, out: Int32Array, offset: number): number {
  if (from === goal || from === NOWHERE || goal === NOWHERE) return 0;

  const { grid } = world;
  const goalColumn = grid.columnOf(goal);
  const goalRow = grid.rowOf(goal);

  const remaining = (tile: TileIndex): number => {
    const across = Math.abs(grid.columnOf(tile) - goalColumn);
    const down = Math.abs(grid.rowOf(tile) - goalRow);
    return (Math.max(across, down) + (DIAGONAL - 1) * Math.min(across, down)) * CHEAPEST_STEP;
  };

  const cost = new Map<TileIndex, number>([[from, 0]]);
  const came = new Map<TileIndex, TileIndex>();
  const closed = new Set<TileIndex>();
  const open = new MinHeap();
  open.push(remaining(from) * HASTE, from);

  let nearest = from;
  let nearestRemaining = remaining(from);
  let expanded = 0;

  while (open.size > 0 && expanded < MAX_EXPANSIONS) {
    const node = open.pop();
    if (closed.has(node)) continue;
    closed.add(node);

    if (node === goal) {
      nearest = goal;
      break;
    }
    expanded += 1;

    const left = remaining(node);
    if (left < nearestRemaining) {
      nearest = node;
      nearestRemaining = left;
    }

    const column = grid.columnOf(node);
    const row = grid.rowOf(node);
    for (const [dx, dy] of AROUND) {
      const next = grid.at(column + dx, row + dy);
      if (next === NOWHERE || closed.has(next) || !world.passable(next)) continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal && (!world.passable(grid.at(column + dx, row)) || !world.passable(grid.at(column, row + dy)))) continue;

      const pace = world.pace(node, next);
      if (pace <= 0) continue;
      const step = cost.get(node)! + (diagonal ? DIAGONAL : 1) / pace;
      const known = cost.get(next);
      if (known !== undefined && known <= step) continue;

      cost.set(next, step);
      came.set(next, node);
      open.push(step + remaining(next) * HASTE, next);
    }
  }

  const route: TileIndex[] = [];
  for (let at = nearest; at !== from; at = came.get(at)!) route.push(at);
  route.reverse();

  const length = Math.min(route.length, PATH_LIMIT);
  for (let step = 0; step < length; step += 1) out[offset + step] = route[step]!;
  return length;
}
