import { buildField } from '../sim/terrain/worldfield.ts';
import { World } from '../sim/world.ts';
import type { LevelResult, Logger } from './harness.ts';
import { check, TEST_SEED } from './harness.ts';
import { header } from './render.ts';

function hashOf(values: ArrayLike<number>, stride = 1): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < values.length; i += stride) {
    hash = Math.imul(hash ^ (values[i]! * 1024) | 0, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function runLevel2(log: Logger): LevelResult {
  log(header('LEVEL 2 — Determinism: a seed builds the same world twice'));

  const first = buildField(TEST_SEED);
  const second = buildField(TEST_SEED);

  const height = hashOf(first.height, 13) === hashOf(second.height, 13);
  const biome = hashOf(first.biome, 13) === hashOf(second.biome, 13);
  const water = hashOf(first.water, 13) === hashOf(second.water, 13);
  const wind = hashOf(first.wind, 13) === hashOf(second.wind, 13);
  const weather = hashOf(first.weather.data, 7) === hashOf(second.weather.data, 7);
  const rivers = first.rivers.segments.length === second.rivers.segments.length;

  const here = World.generate(TEST_SEED);
  const again = World.generate(TEST_SEED);
  const cover = hashOf(here.cover, 13) === hashOf(again.cover, 13);

  const other = buildField(TEST_SEED + 1);
  const differs = hashOf(first.biome, 13) !== hashOf(other.biome, 13);

  log(`    ${first.rivers.segments.length} river reaches, ${first.grid.count} cells`);

  const held = [
    check(log, 'the height comes out the same', height),
    check(log, 'the biomes come out the same', biome),
    check(log, 'the water comes out the same', water),
    check(log, 'the wind comes out the same', wind),
    check(log, 'the weather comes out the same', weather),
    check(log, 'the rivers come out the same', rivers),
    check(log, 'the cover comes out the same', cover),
    check(log, 'another seed is another world', differs),
  ];

  const passed = held.every(Boolean);
  return {
    title: 'determinism',
    passed,
    detail: passed ? 'a seed is the whole world' : 'the world drifts between builds',
  };
}
