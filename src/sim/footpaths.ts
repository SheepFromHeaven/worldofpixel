import type { Vec2 } from './geometry.ts';
import { PARCEL, cellAt, parcelIndex, parcelOf, siteOf } from './parcels.ts';
import { biomeAt, groundBiomeAt } from './terrain.ts';
import { Biome } from './types.ts';
import type { CellId } from './types.ts';
import type { GameWorld } from './world.ts';
import { isWater } from './worldfield.ts';

/**
 * The ground as somewhere to walk, and the paths that walking wears into it.
 *
 * Nobody lays a road. The ground is a network of nodes — the middle of every parcel and every
 * corner of it — joined middle-to-corner and corner-to-corner along the parcels' edges, and every
 * time a villager steps on a node its count goes up (`GameWorld.wear`). Routes are found across
 * the network by cost: worn ground is cheaper to cross and quicker to walk, rough ground dearer
 * and slower, so traffic falls into the tracks traffic has already made and a well-used way
 * deepens into a road. Wear fades, slowly, so a way nobody takes any more grows back.
 *
 * A node's id is its place: `c:column:row` for a parcel's middle, `v:x:y` for a corner (its
 * position in ten-thousandths, which two parcels sharing the corner agree on to the last digit).
 * Everything here is a pure function of the seed and the wear, so routes are the same on every
 * machine.
 */

export type NodeId = string;

/** Steps that make a node fully worn: a path at its widest and its cheapest. */
export const WEAR_FULL = 40;
/** Worn all the way, ground costs this much less to cross. */
const WORN_DISCOUNT = 0.5;
/** Worn all the way, ground is walked this much faster. */
const WORN_SPEEDUP = 0.5;
/** Every so many ticks, every worn node loses a step. */
export const WEAR_FADE_TICKS = 300;
/**
 * How far a route search may look before it gives up: a long way round a lake, but not the world.
 * A town's walks touch a few hundred nodes; a search that has seen this many is looking for a way
 * across water there is none of, and every failed search is paid in full.
 */
const MAX_EXPANSIONS = 8_000;

/** How hard each ground is to cross, against open meadow. */
const ROUGHNESS: Record<Biome, number> = {
  [Biome.Meadow]: 1,
  [Biome.Desert]: 1.15,
  [Biome.Tundra]: 1.2,
  [Biome.Highland]: 1.3,
  [Biome.Forest]: 1.5,
  [Biome.Marsh]: 1.8,
  [Biome.Ocean]: Infinity,
  [Biome.Lake]: Infinity,
  [Biome.River]: Infinity,
};

export const cellNode = (cellId: CellId): NodeId => `c:${cellId}`;
const cornerNode = (v: Vec2): NodeId => `v:${Math.round(v.x * 1e4)}:${Math.round(v.y * 1e4)}`;

interface Node {
  x: number;
  y: number;
  /** Rough or worn, how much it costs to step here; Infinity for water. */
  roughness: number;
  /** For a corner, the parcels that meet at it; for a middle, its own parcel. */
  cells: CellId[];
}

const nodes = new Map<string, Node>();
let nodesSeed: number | null = null;

function nodeOf(world: GameWorld, id: NodeId): Node {
  if (nodesSeed !== world.seed) {
    nodes.clear();
    nodesSeed = world.seed;
  }
  const known = nodes.get(id);
  if (known) return known;

  let node: Node;
  if (id.startsWith('c:')) {
    const cellId = id.slice(2);
    const { column, row } = parcelIndex(cellId);
    const at = siteOf(world.seed, PARCEL, column, row);
    node = { x: at.x, y: at.y, roughness: roughnessAt(world, at), cells: [cellId] };
  } else {
    const [, xs, ys] = id.split(':');
    const at = { x: Number(xs) / 1e4, y: Number(ys) / 1e4 };
    node = { x: at.x, y: at.y, roughness: roughnessAt(world, at), cells: cellsAtCorner(world, at, id) };
  }
  if (nodes.size > 400_000) nodes.clear();
  nodes.set(id, node);
  return node;
}

function roughnessAt(world: GameWorld, at: Vec2): number {
  if (isWater(biomeAt(world.seed, at))) return Infinity;
  return ROUGHNESS[groundBiomeAt(world.seed, at)];
}

/** The parcels meeting at a corner: the one it falls in and whichever of its neighbours share it. */
function cellsAtCorner(world: GameWorld, at: Vec2, id: NodeId): CellId[] {
  const home = cellAt(world.seed, PARCEL, at);
  return [home, ...parcelOf(world.seed, home).neighbors].filter((cell) =>
    parcelOf(world.seed, cell).vertices.some((v) => cornerNode(v) === id),
  );
}

export function positionOf(world: GameWorld, id: NodeId): Vec2 {
  const node = nodeOf(world, id);
  return { x: node.x, y: node.y };
}

/**
 * The nodes one step from a node, in a fixed order: a middle's corners round its parcel; a
 * corner's middles, then the corners either side of it along each parcel's edge.
 */
const adjacency = new Map<string, NodeId[]>();

export function neighbours(world: GameWorld, id: NodeId): NodeId[] {
  const key = `${world.seed}|${id}`;
  const known = adjacency.get(key);
  if (known) return known;

  const out: NodeId[] = [];
  const add = (next: NodeId): void => {
    if (next !== id && !out.includes(next)) out.push(next);
  };
  if (id.startsWith('c:')) {
    for (const v of parcelOf(world.seed, id.slice(2)).vertices) add(cornerNode(v));
  } else {
    const cells = nodeOf(world, id).cells;
    for (const cell of cells) add(cellNode(cell));
    for (const cell of cells) {
      const ring = parcelOf(world.seed, cell).vertices.map(cornerNode);
      const at = ring.indexOf(id);
      if (at < 0) continue;
      add(ring[(at + ring.length - 1) % ring.length]!);
      add(ring[(at + 1) % ring.length]!);
    }
  }

  if (adjacency.size > 400_000) adjacency.clear();
  adjacency.set(key, out);
  return out;
}

/** How worn a node is, 0 to 1. */
export function wornness(world: GameWorld, id: NodeId): number {
  return Math.min(1, (world.wear.get(id) ?? 0) / WEAR_FULL);
}

/** A villager has stepped on a node. */
export function stepOn(world: GameWorld, id: NodeId): void {
  world.wear.set(id, (world.wear.get(id) ?? 0) + 1);
}

/**
 * Paths grow back: every worn node loses a step, and is forgotten at none. Iterated in the order
 * the nodes were first stepped on, so it is the same on every run.
 */
export function fadeWear(world: GameWorld): void {
  for (const [id, steps] of world.wear) {
    if (steps <= 1) world.wear.delete(id);
    else world.wear.set(id, steps - 1);
  }
}

/** How fast a villager crosses a node, against open meadow: quicker on a path, slower in a wood. */
export function paceAt(world: GameWorld, id: NodeId): number {
  const rough = nodeOf(world, id).roughness;
  if (!Number.isFinite(rough)) return 1;
  return (1 + WORN_SPEEDUP * wornness(world, id)) / rough;
}

function stepCost(world: GameWorld, a: NodeId, b: NodeId): number {
  const from = nodeOf(world, a);
  const to = nodeOf(world, b);
  if (!Number.isFinite(to.roughness)) return Infinity;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const rough = (from.roughness + to.roughness) / 2;
  const worn = (wornness(world, a) + wornness(world, b)) / 2;
  return length * rough * (1 - WORN_DISCOUNT * worn);
}

/** The cost of walking a route, for comparing one way with another. */
export function routeCost(world: GameWorld, route: readonly NodeId[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i += 1) total += stepCost(world, route[i - 1]!, route[i]!);
  return total;
}

/**
 * The cheapest walk from one parcel's middle to another's, as the nodes stepped on in order, both
 * ends included; null when there is none within reach (across the sea, say). A*, with the
 * straight line at the cheapest ground there is as the estimate, so it never overestimates and the
 * route is the cheapest one. Ties go to the node found first, so it is the same route every time.
 */
export function route(world: GameWorld, from: CellId, to: CellId): NodeId[] | null {
  const start = cellNode(from);
  const goal = cellNode(to);
  if (start === goal) return [start];
  const end = nodeOf(world, goal);
  if (!Number.isFinite(end.roughness) || !Number.isFinite(nodeOf(world, start).roughness)) return null;

  const floor = 1 - WORN_DISCOUNT;
  const estimate = (id: NodeId): number => {
    const node = nodeOf(world, id);
    return Math.hypot(end.x - node.x, end.y - node.y) * floor;
  };

  const spent = new Map<NodeId, number>([[start, 0]]);
  const cameFrom = new Map<NodeId, NodeId>();
  const closed = new Set<NodeId>();
  const heap = new Heap();
  let order = 0;
  heap.push(estimate(start), order++, start);

  while (heap.size > 0) {
    const current = heap.pop()!;
    if (closed.has(current)) continue;
    if (current === goal) {
      const walk = [goal];
      let at = goal;
      while (at !== start) {
        at = cameFrom.get(at)!;
        walk.unshift(at);
      }
      return walk;
    }
    closed.add(current);
    if (closed.size > MAX_EXPANSIONS) return null;

    const base = spent.get(current)!;
    for (const next of neighbours(world, current)) {
      if (closed.has(next)) continue;
      const cost = base + stepCost(world, current, next);
      if (!Number.isFinite(cost) || cost >= (spent.get(next) ?? Infinity)) continue;
      spent.set(next, cost);
      cameFrom.set(next, current);
      heap.push(cost + estimate(next), order++, next);
    }
  }
  return null;
}

/** A min-heap on (priority, order), so equal priorities come out in the order they went in. */
class Heap {
  private readonly items: { priority: number; order: number; id: NodeId }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(priority: number, order: number, id: NodeId): void {
    const items = this.items;
    items.push({ priority, order, id });
    let at = items.length - 1;
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (!this.before(at, parent)) break;
      [items[at], items[parent]] = [items[parent]!, items[at]!];
      at = parent;
    }
  }

  pop(): NodeId | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0 && last) {
      items[0] = last;
      let at = 0;
      for (;;) {
        const left = at * 2 + 1;
        const right = left + 1;
        let best = at;
        if (left < items.length && this.before(left, best)) best = left;
        if (right < items.length && this.before(right, best)) best = right;
        if (best === at) break;
        [items[at], items[best]] = [items[best]!, items[at]!];
        at = best;
      }
    }
    return top?.id;
  }

  private before(a: number, b: number): boolean {
    const x = this.items[a]!;
    const y = this.items[b]!;
    return x.priority < y.priority || (x.priority === y.priority && x.order < y.order);
  }
}
