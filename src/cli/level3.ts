import { Water } from '../sim/terrain/hydrology.ts';
import { landFraction } from '../sim/terrain/terrain.ts';
import { isFresh, isWater, waterCheck } from '../sim/terrain/worldfield.ts';
import { Biome } from '../sim/types.ts';
import { World } from '../sim/world.ts';
import type { LevelResult, Logger } from './harness.ts';
import { check, TEST_SEED } from './harness.ts';
import { header } from './render.ts';

export function runLevel3(log: Logger): LevelResult {
  log(header('LEVEL 3 — The water: three biomes, and they are what blocks'));

  const world = World.generate(TEST_SEED);
  const { field, grid } = world;

  const counts = new Array<number>(9).fill(0);
  for (let i = 0; i < field.biome.length; i += 1) counts[field.biome[i]!] = counts[field.biome[i]!]! + 1;

  const land = landFraction(TEST_SEED);
  log(`    land ${(land * 100).toFixed(1)}%, ocean ${counts[Biome.Ocean]}, lake ${counts[Biome.Lake]}`);
  log(`    ${field.rivers.segments.length} river reaches drawn`);

  let agrees = true;
  for (let i = 0; i < field.biome.length && agrees; i += 1_013) {
    const wet = field.water[i]!;
    const biome = field.biome[i]!;
    if (wet === Water.Ocean && biome !== Biome.Ocean) agrees = false;
    if (wet === Water.Lake && biome !== Biome.Lake) agrees = false;
    if (wet === Water.None && (biome === Biome.Ocean || biome === Biome.Lake)) agrees = false;
  }

  let blocks = true;
  for (let i = 0; i < grid.count && blocks; i += 1_013) {
    const wet = isWater(field.biome[i]! as Biome);
    if (world.walkable(i) === wet) blocks = false;
    if (wet !== (waterCheck(field.biome[i]! as Biome) !== null)) blocks = false;
  }

  let beyond = true;
  const edge = (column: number, row: number): boolean =>
    field.biome[row * grid.columns + column] === Biome.Ocean;
  for (let column = 0; column < grid.columns && beyond; column += 1) {
    if (!edge(column, 0) || !edge(column, grid.rows - 1)) beyond = false;
  }
  for (let row = 0; row < grid.rows && beyond; row += 1) {
    if (!edge(0, row) || !edge(grid.columns - 1, row)) beyond = false;
  }

  const freshIsFresh = isFresh(Biome.Lake) && isFresh(Biome.River) && !isFresh(Biome.Ocean);

  const held = [
    check(log, 'the world has land to stand on', land >= 0.15, `${(land * 100).toFixed(1)}%`),
    check(log, 'the world has a sea', counts[Biome.Ocean]! > 0),
    check(log, 'the world has rivers', field.rivers.segments.length > 0),
    check(log, 'the water sheet and the biomes agree', agrees),
    check(log, 'water is what refuses, on every count', blocks),
    check(log, 'the skirt round the world is all sea', beyond),
    check(log, 'the sea is the one shore that gives nothing', freshIsFresh),
  ];

  const passed = held.every(Boolean);
  return {
    title: 'the water',
    passed,
    detail: passed ? 'sea, lake and river all block alike' : 'the water does not agree with itself',
  };
}
