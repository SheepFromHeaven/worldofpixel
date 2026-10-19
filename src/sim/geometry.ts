export interface Vec2 {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const vec = (x: number, y: number): Vec2 => ({ x, y });

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const length = (a: Vec2): number => Math.hypot(a.x, a.y);
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(b.x - a.x, b.y - a.y);
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export function normalize(a: Vec2): Vec2 {
  const len = length(a) || 1;
  return { x: a.x / len, y: a.y / len };
}

export function boundsOf(points: readonly Vec2[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

export function boundsCorners(bounds: Bounds): Vec2[] {
  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
}

export function polygonArea(points: readonly Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function polygonCentroid(points: readonly Vec2[]): Vec2 {
  const area = polygonArea(points);
  if (Math.abs(area) < 1e-9) {
    const sum = points.reduce((acc, p) => add(acc, p), vec(0, 0));
    return scale(sum, 1 / Math.max(1, points.length));
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const cross = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

export function pointInPolygon(point: Vec2, polygon: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const straddles = a.y > point.y !== b.y > point.y;
    if (straddles && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Pull a point toward the polygon centroid so building footprints never straddle an edge. */
export function insetTowardCentroid(point: Vec2, polygon: readonly Vec2[], amount: number): Vec2 {
  const centroid = polygonCentroid(polygon);
  const away = sub(point, centroid);
  const len = length(away);
  if (len <= amount) return centroid;
  return add(centroid, scale(away, (len - amount) / len));
}

export function totalPathLength(points: readonly Vec2[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distance(points[i - 1]!, points[i]!);
  return total;
}

/** Position at `t` (0..1) of arc length along a polyline, plus the heading there. */
export function pointAlongPath(points: readonly Vec2[], t: number): { position: Vec2; heading: Vec2 } {
  const first = points[0] ?? vec(0, 0);
  if (points.length < 2) return { position: first, heading: vec(1, 0) };

  const target = Math.min(1, Math.max(0, t)) * totalPathLength(points);
  let travelled = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const segment = distance(a, b);
    if (travelled + segment >= target || i === points.length - 1) {
      const local = segment === 0 ? 0 : (target - travelled) / segment;
      return { position: lerp(a, b, Math.min(1, local)), heading: normalize(sub(b, a)) };
    }
    travelled += segment;
  }
  return { position: points[points.length - 1]!, heading: vec(1, 0) };
}

/**
 * Chaikin corner cutting. A route through parcel centroids is a zigzag of straight hops; two
 * passes of this round it into something a person would have worn into the ground, while keeping
 * every point inside the original corridor so carriers never walk outside the dirt.
 */
export function smoothPolyline(points: readonly Vec2[], passes = 2): Vec2[] {
  let current = [...points];

  for (let pass = 0; pass < passes && current.length > 2; pass += 1) {
    const next: Vec2[] = [current[0]!];
    for (let i = 0; i < current.length - 1; i += 1) {
      const a = current[i]!;
      const b = current[i + 1]!;
      next.push(lerp(a, b, 0.25), lerp(a, b, 0.75));
    }
    next.push(current[current.length - 1]!);
    current = next;
  }

  return current;
}

/** Chaikin on a closed loop: same corner cutting, with no endpoints to pin down. */
export function smoothLoop(points: readonly Vec2[], passes = 1): Vec2[] {
  let current = [...points];

  for (let pass = 0; pass < passes && current.length > 3; pass += 1) {
    const next: Vec2[] = [];
    for (let i = 0; i < current.length; i += 1) {
      const a = current[i]!;
      const b = current[(i + 1) % current.length]!;
      next.push(lerp(a, b, 0.25), lerp(a, b, 0.75));
    }
    current = next;
  }

  return current;
}
