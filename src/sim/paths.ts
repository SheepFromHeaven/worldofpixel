import type { BuildingId, Path, PathId, Settlement } from './types.ts';

export function otherEnd(path: Path, from: BuildingId): BuildingId {
  return path.fromId === from ? path.toId : path.fromId;
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
): PathId[] | null {
  if (from === to) return [];

  const cameFrom = new Map<BuildingId, { path: PathId; previous: BuildingId }>();
  const seen = new Set<BuildingId>([from]);
  const queue: BuildingId[] = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const path of settlement.paths.values()) {
      if (path.fromId !== current && path.toId !== current) continue;
      const next = otherEnd(path, current);
      if (seen.has(next)) continue;
      seen.add(next);
      cameFrom.set(next, { path: path.id, previous: current });
      if (next === to) {
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
      queue.push(next);
    }
  }

  return null;
}
