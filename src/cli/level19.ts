import { placeOf } from '../render/lit/skyGrid.ts';
import { skyAt } from '../render/lit/lighting.ts';
import { World } from '../sim/world.ts';
import type { LevelResult, Logger } from './harness.ts';
import { check, TEST_SEED } from './harness.ts';
import { header } from './render.ts';

const brightness = (colour: readonly [number, number, number]): number => (colour[0] + colour[1] + colour[2]) / 3;

export function runLevel19(log: Logger): LevelResult {
  log(header('LEVEL 19 — The light: day, night and the moon, place by place'));

  const world = World.generate(TEST_SEED);
  const middleOfMap = { x: world.grid.minX + (world.grid.columns * world.grid.spacing) / 2, y: world.grid.y(world.grid.rows / 2) };
  const westEdge = { x: world.grid.minX + world.grid.spacing * 10, y: middleOfMap.y };
  const eastEdge = { x: world.grid.minX + (world.grid.columns - 10) * world.grid.spacing, y: middleOfMap.y };

  const at = (point: { x: number; y: number }, timeOfDay: number, moonPhase = 0) =>
    skyAt(
      { timeOfDay, seasonPhase: 0.125, moonPhase, completedDays: 0 },
      placeOf(world.grid, world.seed, point),
    );

  const noonInTheMiddle = at(middleOfMap, 0.5);
  const midnightInTheMiddle = at(middleOfMap, 0);
  const noonAtTheWestEdge = at(westEdge, 0.5);
  const noonAtTheEastEdge = at(eastEdge, 0.5);
  const fullMoonNight = at(middleOfMap, 0, 0.5);
  const newMoonNight = at(middleOfMap, 0, 0);

  log(`    daylight: noon in the middle ${noonInTheMiddle.daylight.toFixed(2)}, west edge ${noonAtTheWestEdge.daylight.toFixed(2)}, east edge ${noonAtTheEastEdge.daylight.toFixed(2)}`);

  const results = [
    check(log, 'it is day at noon in the middle of the map and night at midnight',
      noonInTheMiddle.daylight > 0.95 && midnightInTheMiddle.daylight < 0.05),
    check(log, 'when it is noon in the middle, the far edges are in dawn and dusk, not noon',
      noonAtTheWestEdge.daylight < 0.5 && noonAtTheEastEdge.daylight < 0.5),
    check(log, 'a full moon lights the night and a new moon does not',
      brightness(fullMoonNight.moon) > 0.05 && brightness(newMoonNight.moon) < 0.001),
    check(log, 'the sun casts shadows by day and the moon by night',
      noonInTheMiddle.sunShadow > 0.3 && fullMoonNight.moonShadow > 0.1 && midnightInTheMiddle.sunShadow === 0),
    check(log, 'the night is darker than the day', midnightInTheMiddle.gloom > 0.4 && noonInTheMiddle.gloom < 0.01),
  ];

  const passed = results.every(Boolean);
  return { title: 'The light', passed, detail: passed ? 'every place has its own sky' : 'a place has the wrong sky' };
}
