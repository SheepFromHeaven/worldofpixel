import type { BuildingId, Path, PathId, Settlement } from './types.ts';

export function otherEnd(path: Path, from: BuildingId): BuildingId {
  return path.fromId === from ? path.toId : path.fromId;
}

/**
 * Every route worked out so far, per path network.
 *
 * Dispatch asks for the same routes over and over — every source and taker, for every idle
 * carrier, every tick — and each answer is a search that rescans every path at every step. In a
 * town of sixty buildings that was a tick of most of a frame. A route only changes when the roads
 * do, and `rebuildPaths` never edits the network in place: it builds a new one and swaps it in.
 * So the cache is keyed on the network itself, and a new network starts with an empty one — there
 * is no invalidation to remember, and nothing that can go stale.
 *
 * A route handed out is shared: callers read it or copy it (`setRoute`), never change it.
 */
const known = new WeakMap<Settlement['paths'], Map<string, readonly PathId[] | null>>();

/**
 * Which paths leave each building, per network — built once, so a search follows a building's
 * own paths instead of rescanning every path in the town at every step. Each list keeps the
 * network's insertion order, which is the order the scan met them in, so ties still break the
 * same way and the routes are the routes they always were.
 */
const leaving = new WeakMap<Settlement['paths'], Map<BuildingId, Path[]>>();

function pathsFrom(settlement: Settlement): Map<BuildingId, Path[]> {
  let byBuilding = leaving.get(settlement.paths);
  if (byBuilding) return byBuilding;
  byBuilding = new Map();
  for (const path of settlement.paths.values()) {
    for (const end of [path.fromId, path.toId]) {
      const list = byBuilding.get(end) ?? [];
      if (list[list.length - 1] !== path) list.push(path);
      byBuilding.set(end, list);
    }
  }
  leaving.set(settlement.paths, byBuilding);
  return byBuilding;
}

/**
 * Shortest walk in legs, breadth-first over the path graph. Paths are visited in insertion order
 * so two equally short routes always resolve the same way — carriers must not pick by chance.
 *
 * The paths themselves are derived from the dirt the player laid (`roads.ts`); this only decides
 * which of them to string together.
 */
export function routeBetween(
  settlement: Settlement,
  from: BuildingId,
  to: BuildingId,
): readonly PathId[] | null {
  if (from === to) return [];

  let routes = known.get(settlement.paths);
  if (!routes) {
    routes = new Map();
    known.set(settlement.paths, routes);
  }
  const key = `${from}>${to}`;
  const cached = routes.get(key);
  if (cached !== undefined) return cached;

  const route = search(settlement, from, to);
  routes.set(key, route);
  return route;
}

/** How the breadth-first walk out of one building reached every other: the leg in, and from where. */
type Tree = Map<BuildingId, { path: PathId; previous: BuildingId }>;

/**
 * The whole breadth-first tree out of a building, per network. One walk answers the route to
 * every building it reaches, so dispatch — which asks for routes out of the same few dozen
 * buildings to all the others — pays for one walk per building rather than one per pair. Walked
 * per pair, a sixty-building town spent its first tick after every change to the roads on four
 * thousand of them.
 */
const trees = new WeakMap<Settlement['paths'], Map<BuildingId, Tree>>();

function treeFrom(settlement: Settlement, from: BuildingId): Tree {
  let byStart = trees.get(settlement.paths);
  if (!byStart) {
    byStart = new Map();
    trees.set(settlement.paths, byStart);
  }
  const known = byStart.get(from);
  if (known) return known;

  const cameFrom: Tree = new Map();
  const seen = new Set<BuildingId>([from]);
  const queue: BuildingId[] = [from];
  const byBuilding = pathsFrom(settlement);

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]!;
    for (const path of byBuilding.get(current) ?? []) {
      const next = otherEnd(path, current);
      if (seen.has(next)) continue;
      seen.add(next);
      cameFrom.set(next, { path: path.id, previous: current });
      queue.push(next);
    }
  }

  byStart.set(from, cameFrom);
  return cameFrom;
}

function search(settlement: Settlement, from: BuildingId, to: BuildingId): PathId[] | null {
  const cameFrom = treeFrom(settlement, from);
  if (!cameFrom.has(to)) return null;
  const legs: PathId[] = [];
  let node = to;
  while (node !== from) {
    const step = cameFrom.get(node);
    if (!step) return null;
    legs.unshift(step.path);
    node = step.previous;
  }
  return legs;
}
