import type { TileGrid } from '../../sim/grid.ts';
import { flowSpeedFor } from '../../sim/aquatic.ts';
import { PEAK_METRES } from '../../sim/terrain/climate.ts';
import type { RiverSegment } from '../../sim/terrain/hydrology.ts';
import { Water } from '../../sim/terrain/hydrology.ts';

export const RIVER_FLOATS_PER_VERTEX = 10;
export const RIVER_VERTICES_PER_SEGMENT = 4;
export const RIVER_INDICES_PER_SEGMENT = 6;

const WATERFALL_MINIMUM_METRES_DROPPED_PER_METRE = 55;
const WATERFALL_MINIMUM_HALF_WIDTH = 0.6;
const SHORTEST_SEGMENT_LENGTH = 0.5;
const POINT_KEY_RESOLUTION = 64;
const MINIMUM_MITRE_COSINE = 0.45;

const pointKey = (x: number, y: number): string =>
  `${Math.round(x * POINT_KEY_RESOLUTION)},${Math.round(y * POINT_KEY_RESOLUTION)}`;

interface Direction {
  x: number;
  y: number;
}

const normalised = (x: number, y: number): Direction => {
  const length = Math.hypot(x, y);
  return length < 1e-6 ? { x: 1, y: 0 } : { x: x / length, y: y / length };
};

export interface RiverMesh {
  vertices: Float32Array;
  indices: Uint32Array;
}

export function riverMesh(
  segments: readonly RiverSegment[],
  terrainHeight: Float32Array,
  waterKind: Uint8Array,
  grid: TileGrid,
): RiverMesh {
  const segmentStartingAt = new Map<string, number>();
  const widestSegmentEndingAt = new Map<string, number>();
  segments.forEach((segment, segmentIndex) => {
    segmentStartingAt.set(pointKey(segment.ax, segment.ay), segmentIndex);
    const endKey = pointKey(segment.bx, segment.by);
    const held = widestSegmentEndingAt.get(endKey);
    if (held === undefined || segments[held]!.half < segment.half) widestSegmentEndingAt.set(endKey, segmentIndex);
  });

  const flowDirections = segments.map((segment) => normalised(segment.bx - segment.ax, segment.by - segment.ay));
  const vertices = new Float32Array(segments.length * RIVER_VERTICES_PER_SEGMENT * RIVER_FLOATS_PER_VERTEX);
  const indices = new Uint32Array(segments.length * RIVER_INDICES_PER_SEGMENT);

  segments.forEach((segment, segmentIndex) => {
    const flowDirection = flowDirections[segmentIndex]!;
    const downstreamIndex = segmentStartingAt.get(pointKey(segment.bx, segment.by));
    const upstreamIndex = widestSegmentEndingAt.get(pointKey(segment.ax, segment.ay));
    const downstream = downstreamIndex === undefined ? null : segments[downstreamIndex]!;
    const downstreamDirection = downstreamIndex === undefined ? flowDirection : flowDirections[downstreamIndex]!;
    const upstreamDirection = upstreamIndex === undefined ? flowDirection : flowDirections[upstreamIndex]!;

    const tangentAtStart = normalised(flowDirection.x + upstreamDirection.x, flowDirection.y + upstreamDirection.y);
    const tangentAtEnd = normalised(flowDirection.x + downstreamDirection.x, flowDirection.y + downstreamDirection.y);

    const heightAtStart = terrainHeight[grid.atPoint({ x: segment.ax, y: segment.ay })] ?? 0;
    const heightAtEnd = terrainHeight[grid.atPoint({ x: segment.bx, y: segment.by })] ?? 0;
    const segmentLength = Math.max(Math.hypot(segment.bx - segment.ax, segment.by - segment.ay), SHORTEST_SEGMENT_LENGTH);
    const metresDroppedPerMetre = ((heightAtStart - heightAtEnd) * PEAK_METRES) / segmentLength;
    const flowSpeed = flowSpeedFor(metresDroppedPerMetre);
    const isWaterfall =
      metresDroppedPerMetre >= WATERFALL_MINIMUM_METRES_DROPPED_PER_METRE && segment.half >= WATERFALL_MINIMUM_HALF_WIDTH
        ? 1
        : 0;
    const endsInStandingWater =
      (waterKind[grid.atPoint({ x: segment.bx, y: segment.by })] ?? Water.None) !== Water.None ? 1 : 0;

    const ends: readonly { x: number; y: number; tangent: Direction; halfWidth: number }[] = [
      { x: segment.ax, y: segment.ay, tangent: tangentAtStart, halfWidth: segment.half },
      { x: segment.bx, y: segment.by, tangent: tangentAtEnd, halfWidth: downstream ? downstream.half : segment.half },
    ];

    ends.forEach((end, endIndex) => {
      const sideways = { x: -end.tangent.y, y: end.tangent.x };
      const cosineBetweenSidewaysAndSegmentNormal = Math.abs(sideways.x * -flowDirection.y + sideways.y * flowDirection.x);
      const mitreStretch = 1 / Math.max(MINIMUM_MITRE_COSINE, cosineBetweenSidewaysAndSegmentNormal);

      for (const side of [-1, 1]) {
        const vertexIndex = segmentIndex * RIVER_VERTICES_PER_SEGMENT + endIndex * 2 + (side + 1) / 2;
        vertices.set(
          [
            end.x + sideways.x * end.halfWidth * mitreStretch * side,
            end.y + sideways.y * end.halfWidth * mitreStretch * side,
            side,
            endIndex,
            flowDirection.x * flowSpeed,
            flowDirection.y * flowSpeed,
            isWaterfall,
            endsInStandingWater,
            end.halfWidth,
            metresDroppedPerMetre,
          ],
          vertexIndex * RIVER_FLOATS_PER_VERTEX,
        );
      }
    });

    const firstVertex = segmentIndex * RIVER_VERTICES_PER_SEGMENT;
    indices.set(
      [firstVertex, firstVertex + 1, firstVertex + 2, firstVertex + 1, firstVertex + 3, firstVertex + 2],
      segmentIndex * RIVER_INDICES_PER_SEGMENT,
    );
  });

  return { vertices, indices };
}
