import { polygonArea } from './geometry.ts';
import type { Vec2 } from './geometry.ts';

/** Vertices are snapped to this fraction of a unit before edges are matched up. */
const WELD = 20;

const pointKey = (point: Vec2): string =>
  `${Math.round(point.x * WELD)}:${Math.round(point.y * WELD)}`;

const edgeKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * The outline of a group of mesh cells: every edge that only one member cell owns is on the
 * border, and those edges chain into a loop. Vertices are welded to a twentieth of a unit first,
 * because two neighbouring cells compute their shared corner independently and the results differ
 * in the last bits — unwelded, the chain breaks at every corner.
 */
export function unionOutline(cells: { vertices: Vec2[] }[]): Vec2[] {
  const counts = new Map<string, number>();
  const points = new Map<string, Vec2>();

  for (const cell of cells) {
    for (let i = 0; i < cell.vertices.length; i += 1) {
      const a = cell.vertices[i]!;
      const b = cell.vertices[(i + 1) % cell.vertices.length]!;
      const ka = pointKey(a);
      const kb = pointKey(b);
      if (ka === kb) continue;
      points.set(ka, a);
      points.set(kb, b);
      const key = edgeKey(ka, kb);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const links = new Map<string, string[]>();
  for (const [key, count] of counts) {
    if (count !== 1) continue;
    const [a, b] = key.split('|') as [string, string];
    links.set(a, [...(links.get(a) ?? []), b]);
    links.set(b, [...(links.get(b) ?? []), a]);
  }

  const walked = new Set<string>();
  let best: Vec2[] = [];

  for (const start of links.keys()) {
    if (walked.has(start)) continue;

    const loop: Vec2[] = [];
    let current = start;
    let previous: string | null = null;

    for (;;) {
      walked.add(current);
      const point = points.get(current);
      if (point) loop.push(point);

      const next = (links.get(current) ?? []).find((candidate) => candidate !== previous && !walked.has(candidate));
      if (!next) break;
      previous = current;
      current = next;
    }

    if (loop.length > best.length && Math.abs(polygonArea(loop)) > Math.abs(polygonArea(best))) {
      best = loop;
    }
  }

  return best;
}
