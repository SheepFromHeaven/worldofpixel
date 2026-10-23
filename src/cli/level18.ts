import { RIVER_FLOATS_PER_VERTEX, riverMesh } from '../render/lit/riverMesh.ts';
import { World } from '../sim/world.ts';
import type { LevelResult, Logger } from './harness.ts';
import { check, TEST_SEED } from './harness.ts';
import { header } from './render.ts';

const VERTICES_PER_SEGMENT = 4;
const INDICES_PER_SEGMENT = 6;
const NEARLY_THE_SAME_POINT = 1e-3;

export function runLevel18(log: Logger): LevelResult {
  log(header('LEVEL 18 — The river mesh: ribbons that bend round corners without a seam'));

  const world = World.generate(TEST_SEED);
  const { segments } = world.field.rivers;
  const mesh = riverMesh(segments, world.field.height, world.field.water, world.grid);
  log(`    ${segments.length} river reaches become ${mesh.indices.length / 3} triangles`);

  const vertexCount = mesh.vertices.length / RIVER_FLOATS_PER_VERTEX;
  const everyIndexIsAVertex = mesh.indices.every((index) => index < vertexCount);
  const everyNumberIsFinite = mesh.vertices.every((value) => Number.isFinite(value));

  const startOfSegment = new Map<string, number>();
  segments.forEach((segment, index) => startOfSegment.set(`${Math.round(segment.ax * 64)},${Math.round(segment.ay * 64)}`, index));

  let joins = 0;
  let joinsThatMeet = 0;
  segments.forEach((segment, index) => {
    const next = startOfSegment.get(`${Math.round(segment.bx * 64)},${Math.round(segment.by * 64)}`);
    if (next === undefined) return;
    joins += 1;
    const ourEndVertex = (index * VERTICES_PER_SEGMENT + 2) * RIVER_FLOATS_PER_VERTEX;
    const theirStartVertex = (next * VERTICES_PER_SEGMENT + 0) * RIVER_FLOATS_PER_VERTEX;
    const distance = Math.hypot(
      mesh.vertices[ourEndVertex]! - mesh.vertices[theirStartVertex]!,
      mesh.vertices[ourEndVertex + 1]! - mesh.vertices[theirStartVertex + 1]!,
    );
    const mirroredDistance = Math.hypot(
      mesh.vertices[ourEndVertex]! - mesh.vertices[theirStartVertex + RIVER_FLOATS_PER_VERTEX]!,
      mesh.vertices[ourEndVertex + 1]! - mesh.vertices[theirStartVertex + RIVER_FLOATS_PER_VERTEX + 1]!,
    );
    if (Math.min(distance, mirroredDistance) < NEARLY_THE_SAME_POINT * Math.max(1, segment.half)) joinsThatMeet += 1;
  });
  log(`    ${joinsThatMeet} of ${joins} joins meet exactly`);

  const fallCount = Array.from({ length: segments.length }, (_, index) => mesh.vertices[index * VERTICES_PER_SEGMENT * RIVER_FLOATS_PER_VERTEX + 6]!).filter((flag) => flag === 1).length;
  log(`    ${fallCount} reaches are waterfalls`);

  const results = [
    check(log, 'every segment is four vertices and six indices',
      mesh.vertices.length === segments.length * VERTICES_PER_SEGMENT * RIVER_FLOATS_PER_VERTEX &&
        mesh.indices.length === segments.length * INDICES_PER_SEGMENT),
    check(log, 'every index names a vertex and every number is finite', everyIndexIsAVertex && everyNumberIsFinite),
    check(log, 'where one reach hands on to the next, their edges meet', joins > 0 && joinsThatMeet / joins > 0.9),
    check(log, 'a few reaches fall, not most of them', fallCount > 0 && fallCount < segments.length * 0.1),
  ];

  const passed = results.every(Boolean);
  return { title: 'The river mesh', passed, detail: passed ? 'ribbons are whole' : 'a ribbon is torn' };
}
