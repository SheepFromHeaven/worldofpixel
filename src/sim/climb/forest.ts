import type { Plants } from '../plants/plants.ts';
import type { World } from '../world.ts';
import type { Ability } from './ability.ts';
import { buildTree, capacityOf, climbable, MAX_NODES } from './tree.ts';
import type { ClimbNode, TreeGraph } from './tree.ts';

export type Link = 'limb' | 'touch' | 'jump' | 'glide';

export interface Edge {
  to: number;
  cost: number;
  link: Link;
}

export interface Reach {
  cost: Map<number, number>;
  from: Map<number, number>;
  links: Map<number, Link>;
}

const NEIGHBOUR_TILES = 14;

const JUMP_UP_SHARE = 0.25;

const JUMP_COST = 2;

const GLIDE_COST = 1.5;

const MAX_EXPANSIONS = 4000;

export const refOf = (tile: number, index: number): number => tile * MAX_NODES + index;

export const tileOfRef = (ref: number): number => Math.floor(ref / MAX_NODES);

export const indexOfRef = (ref: number): number => ref % MAX_NODES;

interface Entry {
  ref: number;
  cost: number;
}

class Heap {
  private readonly items: Entry[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: Entry): void {
    const { items } = this;
    items.push(item);
    let at = items.length - 1;
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (items[parent]!.cost <= items[at]!.cost) break;
      [items[parent], items[at]] = [items[at]!, items[parent]!];
      at = parent;
    }
  }

  pop(): Entry {
    const { items } = this;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let at = 0;
      for (;;) {
        const left = at * 2 + 1;
        const right = left + 1;
        let smallest = at;
        if (left < items.length && items[left]!.cost < items[smallest]!.cost) smallest = left;
        if (right < items.length && items[right]!.cost < items[smallest]!.cost) smallest = right;
        if (smallest === at) break;
        [items[smallest], items[at]] = [items[at]!, items[smallest]!];
        at = smallest;
      }
    }
    return top;
  }
}

export class Forest {
  private readonly trees = new Map<number, TreeGraph | null>();
  private readonly near = new Map<number, number[]>();
  private readonly children = new WeakMap<TreeGraph, number[][]>();

  constructor(
    private readonly world: World,
    private readonly plants: Plants,
    private readonly seed: number,
  ) {}

  tree(tile: number): TreeGraph | null {
    const known = this.trees.get(tile);
    if (known !== undefined) return known;
    const species = this.plants.speciesAt(tile, 'canopy');
    const metres = this.plants.heightOf(tile, 'canopy');
    let built: TreeGraph | null = null;
    if (climbable(species, metres)) {
      const centre = this.world.grid.centre(tile);
      built = buildTree(this.seed, tile, centre.x, centre.y, species, metres);
    }
    this.trees.set(tile, built);
    return built;
  }

  node(ref: number): ClimbNode | null {
    return this.tree(tileOfRef(ref))?.nodes[indexOfRef(ref)] ?? null;
  }

  private neighbours(tree: TreeGraph): TreeGraph[] {
    let tiles = this.near.get(tree.tile);
    if (!tiles) {
      tiles = [];
      const { grid } = this.world;
      const column = grid.columnOf(tree.tile);
      const row = grid.rowOf(tree.tile);
      for (let dy = -NEIGHBOUR_TILES; dy <= NEIGHBOUR_TILES; dy += 1) {
        for (let dx = -NEIGHBOUR_TILES; dx <= NEIGHBOUR_TILES; dx += 1) {
          if ((dx === 0 && dy === 0) || dx * dx + dy * dy > NEIGHBOUR_TILES * NEIGHBOUR_TILES) continue;
          const at = grid.at(column + dx, row + dy);
          if (at >= 0 && this.tree(at)) tiles.push(at);
        }
      }
      this.near.set(tree.tile, tiles);
    }
    return tiles.map((tile) => this.tree(tile)!);
  }

  private childrenOf(tree: TreeGraph): number[][] {
    let lists = this.children.get(tree);
    if (!lists) {
      lists = tree.nodes.map(() => []);
      tree.nodes.forEach((node, index) => {
        if (node.parent >= 0) lists![node.parent]!.push(index);
      });
      this.children.set(tree, lists);
    }
    return lists;
  }

  holds(tree: TreeGraph, node: ClimbNode, ability: Ability): boolean {
    if (capacityOf(node.radius, tree.species.wood) < ability.mass * ability.safety) return false;
    return node.kind !== 'trunk' || (node.radius >= ability.gripMin && node.radius <= ability.gripMax);
  }

  edges(ref: number, ability: Ability): Edge[] {
    const tree = this.tree(tileOfRef(ref));
    if (!tree) return [];
    const index = indexOfRef(ref);
    const node = tree.nodes[index]!;
    const out: Edge[] = [];
    const limb = (other: number): void => {
      const to = tree.nodes[other]!;
      if (this.holds(tree, to, ability)) out.push({ to: refOf(tree.tile, other), cost: Math.hypot(to.x - node.x, to.y - node.y, to.z - node.z), link: 'limb' });
    };
    if (node.parent >= 0) limb(node.parent);
    for (const child of this.childrenOf(tree)[index]!) limb(child);
    if (ability.touch <= 0 && ability.jump <= 0 && ability.glide <= 0) return out;
    const gap = Math.max(ability.touch, ability.jump, ability.glideMax);
    for (const other of this.neighbours(tree)) {
      if (Math.hypot(other.x - tree.x, other.y - tree.y) > tree.crownRadius + other.crownRadius + gap) continue;
      for (let at = 0; at < other.nodes.length; at += 1) {
        const target = other.nodes[at]!;
        if (!this.holds(other, target, ability)) continue;
        const horizontal = Math.hypot(target.x - node.x, target.y - node.y);
        const rise = target.z - node.z;
        const distance = Math.hypot(horizontal, rise);
        const to = refOf(other.tile, at);
        if (distance <= ability.touch) out.push({ to, cost: distance, link: 'touch' });
        else if (ability.jump > 0 && horizontal <= ability.jump && rise <= ability.jump * JUMP_UP_SHARE && capacityOf(target.radius, other.species.wood) >= ability.mass * ability.landing) out.push({ to, cost: distance * JUMP_COST, link: 'jump' });
        else if (ability.glide > 0 && horizontal <= ability.glideMax && -rise >= horizontal / ability.glide && capacityOf(target.radius, other.species.wood) >= ability.mass * ability.landing) out.push({ to, cost: distance * GLIDE_COST, link: 'glide' });
      }
    }
    return out;
  }

  reach(startTile: number, ability: Ability, limit = MAX_EXPANSIONS): Reach {
    const result: Reach = { cost: new Map(), from: new Map(), links: new Map() };
    const tree = this.tree(startTile);
    if (!tree || !this.holds(tree, tree.nodes[0]!, ability)) return result;
    const start = refOf(startTile, 0);
    const heap = new Heap();
    result.cost.set(start, 0);
    heap.push({ ref: start, cost: 0 });
    let expanded = 0;
    while (heap.size > 0 && expanded < limit) {
      const { ref, cost } = heap.pop();
      if (cost > (result.cost.get(ref) ?? Infinity)) continue;
      expanded += 1;
      for (const edge of this.edges(ref, ability)) {
        const next = cost + edge.cost;
        if (next >= (result.cost.get(edge.to) ?? Infinity)) continue;
        result.cost.set(edge.to, next);
        result.from.set(edge.to, ref);
        result.links.set(edge.to, edge.link);
        heap.push({ ref: edge.to, cost: next });
      }
    }
    return result;
  }

  path(reach: Reach, ref: number): number[] {
    const out = [ref];
    let at = ref;
    while (reach.from.has(at)) {
      at = reach.from.get(at)!;
      out.push(at);
    }
    return out.reverse();
  }
}
