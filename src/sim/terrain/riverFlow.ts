import { flowSpeedFor } from '../aquatic.ts';
import type { TileGrid } from '../grid.ts';
import { PEAK_METRES } from './climate.ts';
import type { RiverSegment } from './hydrology.ts';
import { nodeAverages } from './riverWidth.ts';

export interface RiverFlowTable {
  readonly speed: Float32Array;
  readonly drop: Float32Array;
  readonly indexOf: Map<RiverSegment, number>;
}

const SHORTEST_SEGMENT_LENGTH = 0.5;

const built = new WeakMap<readonly RiverSegment[], RiverFlowTable>();

export function riverFlowTable(segments: readonly RiverSegment[], height: Float32Array, grid: TileGrid): RiverFlowTable {
  const known = built.get(segments);
  if (known) return known;

  const drops = segments.map((segment) => {
    const top = height[grid.atPoint({ x: segment.ax, y: segment.ay })] ?? 0;
    const bottom = height[grid.atPoint({ x: segment.bx, y: segment.by })] ?? 0;
    const length = Math.max(Math.hypot(segment.bx - segment.ax, segment.by - segment.ay), SHORTEST_SEGMENT_LENGTH);
    return ((top - bottom) * PEAK_METRES) / length;
  });

  const indexOf = new Map<RiverSegment, number>();
  segments.forEach((segment, i) => indexOf.set(segment, i));

  const table: RiverFlowTable = {
    speed: nodeAverages(segments, (_segment, i) => flowSpeedFor(drops[i]!)),
    drop: nodeAverages(segments, (_segment, i) => drops[i]!, true),
    indexOf,
  };
  built.set(segments, table);
  return table;
}
