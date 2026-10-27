import type { RiverSegment } from './hydrology.ts';

const POINT_KEY_RESOLUTION = 64;

const pointKey = (x: number, y: number): string =>
  `${Math.round(x * POINT_KEY_RESOLUTION)},${Math.round(y * POINT_KEY_RESOLUTION)}`;

const built = new WeakMap<readonly RiverSegment[], Map<RiverSegment, readonly [number, number]>>();

export function nodeAverages(
  segments: readonly RiverSegment[],
  valueOf: (segment: RiverSegment, index: number) => number,
  largest = false,
): Float32Array {
  const sums = new Map<string, { sum: number; count: number }>();
  const add = (key: string, value: number): void => {
    const held = sums.get(key);
    if (held) {
      held.sum = largest ? Math.max(held.sum, value) : held.sum + value;
      held.count = largest ? 1 : held.count + 1;
    } else sums.set(key, { sum: value, count: 1 });
  };

  segments.forEach((segment, index) => {
    const value = valueOf(segment, index);
    add(pointKey(segment.ax, segment.ay), value);
    add(pointKey(segment.bx, segment.by), value);
  });

  const out = new Float32Array(segments.length * 2);
  segments.forEach((segment, index) => {
    const start = sums.get(pointKey(segment.ax, segment.ay))!;
    const end = sums.get(pointKey(segment.bx, segment.by))!;
    out[index * 2] = start.sum / start.count;
    out[index * 2 + 1] = end.sum / end.count;
  });
  return out;
}

export function riverWidths(segments: readonly RiverSegment[]): Map<RiverSegment, readonly [number, number]> {
  const known = built.get(segments);
  if (known) return known;
  const nodes = nodeAverages(segments, (segment) => segment.half);
  const widths = new Map<RiverSegment, readonly [number, number]>();
  segments.forEach((segment, index) => widths.set(segment, [nodes[index * 2]!, nodes[index * 2 + 1]!]));
  built.set(segments, widths);
  return widths;
}
