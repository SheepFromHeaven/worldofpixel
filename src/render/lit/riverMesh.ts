import type { TileGrid } from '../../sim/grid.ts';
import { flowSpeedFor } from '../../sim/aquatic.ts';
import { PEAK_METRES } from '../../sim/terrain/climate.ts';
import type { RiverSegment } from '../../sim/terrain/hydrology.ts';
import { Aqua } from '../../sim/aquatic.ts';
import { Water } from '../../sim/terrain/hydrology.ts';
import { reachesIn } from '../../sim/terrain/worldfield.ts';
import type { World } from '../../sim/world.ts';
import { hash } from '../groundSprites.ts';
import { nodeAverages, riverWidths } from '../../sim/terrain/riverWidth.ts';

export const RIVER_FLOATS_PER_VERTEX = 10;
export const RIVER_VERTICES_PER_SEGMENT = 4;
export const RIVER_INDICES_PER_SEGMENT = 6;

const WATERFALL_MINIMUM_HALF_WIDTH = 0.6;
const SHORTEST_SEGMENT_LENGTH = 0.5;
const POINT_KEY_RESOLUTION = 64;
const MINIMUM_MITRE_COSINE = 0.45;
const QUAD_SWELL = 1.35;

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

const WAKE_LENGTH = 2.6;
const WAKE_HALF_WIDTH = 0.9;
const WAKE_SPACING = 3.2;
const WAKE_SPEED_FLOOR = 0.2;
const WAKE_REACH = 1.5;
const WAKE_FLAG = 2;
const AQUA_COUNT = [0, 1.4, 0.7, 1, 1.6, 1.2, 1];
const WAKING: ReadonlySet<number> = new Set([Aqua.Reeds, Aqua.Lily, Aqua.Weed]);

interface Wake {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
}

function wakesIn(world: World, segments: readonly RiverSegment[], speeds: Float32Array): Wake[] {
  const { grid } = world;
  const index = new Map<RiverSegment, number>();
  segments.forEach((segment, i) => index.set(segment, i));
  const wakes: Wake[] = [];
  const taken = new Set<string>();

  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const tile = row * grid.columns + column;
      if (!WAKING.has(world.aqua[tile]!)) continue;
      const count = Math.floor(AQUA_COUNT[world.aqua[tile]!]! + hash(column, row, 61));
      for (let n = 0; n < count; n += 1) {
        const x = grid.x(column) + (hash(column, row, 71 + n * 5) - 0.5) * 0.6;
        const y = grid.y(row) + (hash(column, row, 73 + n * 5) - 0.5) * 0.6;
        let best = Infinity;
        let found: RiverSegment | null = null;
        for (const segment of reachesIn(world.field, { minX: x - 4, minY: y - 4, maxX: x + 4, maxY: y + 4 })) {
          const sx = segment.bx - segment.ax;
          const sy = segment.by - segment.ay;
          const along = sx * sx + sy * sy;
          const t = along === 0 ? 0 : Math.max(0, Math.min(1, ((x - segment.ax) * sx + (y - segment.ay) * sy) / along));
          const gap = Math.hypot(segment.ax + sx * t - x, segment.ay + sy * t - y) - segment.half;
          if (gap < best && gap < WAKE_REACH) {
            best = gap;
            found = segment;
          }
        }
        if (!found) continue;
        const i = index.get(found);
        if (i === undefined) continue;
        const speed = (speeds[i * 2]! + speeds[i * 2 + 1]!) / 2;
        if (speed < WAKE_SPEED_FLOOR) continue;
        const cell = `${Math.floor(x / WAKE_SPACING)},${Math.floor(y / WAKE_SPACING)}`;
        if (taken.has(cell)) continue;
        taken.add(cell);
        const direction = normalised(found.bx - found.ax, found.by - found.ay);
        wakes.push({ x, y, dx: direction.x, dy: direction.y, speed });
      }
    }
  }
  return wakes;
}

export function riverMesh(
  segments: readonly RiverSegment[],
  terrainHeight: Float32Array,
  waterKind: Uint8Array,
  grid: TileGrid,
  world: World | null = null,
): RiverMesh {
  const segmentStartingAt = new Map<string, number>();
  const widestSegmentEndingAt = new Map<string, number>();
  segments.forEach((segment, segmentIndex) => {
    segmentStartingAt.set(pointKey(segment.ax, segment.ay), segmentIndex);
    const endKey = pointKey(segment.bx, segment.by);
    const held = widestSegmentEndingAt.get(endKey);
    if (held === undefined || segments[held]!.half < segment.half) widestSegmentEndingAt.set(endKey, segmentIndex);
  });

  const dropOf = segments.map((segment) => {
    const top = terrainHeight[grid.atPoint({ x: segment.ax, y: segment.ay })] ?? 0;
    const bottom = terrainHeight[grid.atPoint({ x: segment.bx, y: segment.by })] ?? 0;
    const length = Math.max(Math.hypot(segment.bx - segment.ax, segment.by - segment.ay), SHORTEST_SEGMENT_LENGTH);
    return ((top - bottom) * PEAK_METRES) / length;
  });
  const nodeSpeeds = nodeAverages(segments, (_segment, index) => flowSpeedFor(dropOf[index]!));
  const nodeDrops = nodeAverages(segments, (_segment, index) => dropOf[index]!, true);
  const widths = riverWidths(segments);

  const flowDirections = segments.map((segment) => normalised(segment.bx - segment.ax, segment.by - segment.ay));
  const wakes = world ? wakesIn(world, segments, nodeSpeeds) : [];
  const riverVertexCount = segments.length * RIVER_VERTICES_PER_SEGMENT;
  const vertices = new Float32Array((riverVertexCount + wakes.length * 4) * RIVER_FLOATS_PER_VERTEX);
  const indices = new Uint32Array(segments.length * RIVER_INDICES_PER_SEGMENT + wakes.length * 6);

  segments.forEach((segment, segmentIndex) => {
    const flowDirection = flowDirections[segmentIndex]!;
    const downstreamIndex = segmentStartingAt.get(pointKey(segment.bx, segment.by));
    const upstreamIndex = widestSegmentEndingAt.get(pointKey(segment.ax, segment.ay));
    const downstreamDirection = downstreamIndex === undefined ? flowDirection : flowDirections[downstreamIndex]!;
    const upstreamDirection = upstreamIndex === undefined ? flowDirection : flowDirections[upstreamIndex]!;

    const tangentAtStart = normalised(flowDirection.x + upstreamDirection.x, flowDirection.y + upstreamDirection.y);
    const tangentAtEnd = normalised(flowDirection.x + downstreamDirection.x, flowDirection.y + downstreamDirection.y);

    const [startWidth, endWidth] = widths.get(segment) ?? [segment.half, segment.half];
    const isWaterfall = segment.half >= WATERFALL_MINIMUM_HALF_WIDTH ? 1 : 0;
    const endsInStandingWater =
      (waterKind[grid.atPoint({ x: segment.bx, y: segment.by })] ?? Water.None) !== Water.None ? 1 : 0;

    const ends: readonly { x: number; y: number; tangent: Direction; halfWidth: number; speed: number; drop: number }[] = [
      { x: segment.ax, y: segment.ay, tangent: tangentAtStart, halfWidth: startWidth, speed: nodeSpeeds[segmentIndex * 2]!, drop: nodeDrops[segmentIndex * 2]! },
      { x: segment.bx, y: segment.by, tangent: tangentAtEnd, halfWidth: endWidth, speed: nodeSpeeds[segmentIndex * 2 + 1]!, drop: nodeDrops[segmentIndex * 2 + 1]! },
    ];

    ends.forEach((end, endIndex) => {
      const sideways = { x: -end.tangent.y, y: end.tangent.x };
      const cosineBetweenSidewaysAndSegmentNormal = Math.abs(sideways.x * -flowDirection.y + sideways.y * flowDirection.x);
      const mitreStretch = 1 / Math.max(MINIMUM_MITRE_COSINE, cosineBetweenSidewaysAndSegmentNormal);

      for (const side of [-1, 1]) {
        const vertexIndex = segmentIndex * RIVER_VERTICES_PER_SEGMENT + endIndex * 2 + (side + 1) / 2;
        vertices.set(
          [
            end.x + sideways.x * end.halfWidth * QUAD_SWELL * mitreStretch * side,
            end.y + sideways.y * end.halfWidth * QUAD_SWELL * mitreStretch * side,
            side,
            endIndex,
            end.tangent.x * end.speed,
            end.tangent.y * end.speed,
            isWaterfall,
            endsInStandingWater,
            end.halfWidth,
            end.drop,
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

  wakes.forEach((wake, k) => {
    const first = riverVertexCount + k * 4;
    const px = -wake.dy;
    const py = wake.dx;
    const corners: readonly (readonly [number, number])[] = [
      [-1, 0],
      [1, 0],
      [-1, 1],
      [1, 1],
    ];
    corners.forEach(([side, along], c) => {
      vertices.set(
        [
          wake.x + px * side * WAKE_HALF_WIDTH + wake.dx * along * WAKE_LENGTH,
          wake.y + py * side * WAKE_HALF_WIDTH + wake.dy * along * WAKE_LENGTH,
          side,
          along,
          wake.dx * wake.speed,
          wake.dy * wake.speed,
          0,
          WAKE_FLAG,
          WAKE_HALF_WIDTH,
          hash(Math.round(wake.x * 8), Math.round(wake.y * 8), 5) * 2 - 1,
        ],
        (first + c) * RIVER_FLOATS_PER_VERTEX,
      );
    });
    indices.set([first, first + 1, first + 2, first + 1, first + 3, first + 2], segments.length * RIVER_INDICES_PER_SEGMENT + k * 6);
  });

  return { vertices, indices };
}
