import { southernSeasonPhaseOf } from '../sim/astro.ts';
import {
  encodeForShader,
  FLOATS_PER_SEASONAL_KIND,
  SEASONAL_LIMIT,
  SEASONAL_PLANT_KINDS,
  seasonalKindIndexForSprite,
  seasonalStateForBothHemispheres,
} from '../sim/seasons/seasonalRegistry.ts';
import type { LevelResult, Logger } from './harness.ts';
import { check } from './harness.ts';
import { header } from './render.ts';

const LATE_AUTUMN = 0.72;
const WINTER = 0.8;
const SPRING = 0.2;

export function runLevel16(log: Logger): LevelResult {
  log(header('LEVEL 16 — The seasons: every plant answers the year, each hemisphere on its own half'));

  const oakIndex = seasonalKindIndexForSprite('tree.oak.v0.mid');
  const oakLeafLossOffset = oakIndex * FLOATS_PER_SEASONAL_KIND + 1;
  const hemisphereOffset = SEASONAL_LIMIT * FLOATS_PER_SEASONAL_KIND;

  const midwinterNorth = seasonalStateForBothHemispheres(WINTER, southernSeasonPhaseOf(WINTER));
  const northernOakInWinter = midwinterNorth.shaderTable[oakLeafLossOffset]!;
  const southernOakInWinter = midwinterNorth.shaderTable[hemisphereOffset + oakLeafLossOffset]!;
  log(`    oak leaf loss at a northern midwinter: north ${northernOakInWinter.toFixed(2)}, south ${southernOakInWinter.toFixed(2)}`);

  const flowerKinds = ['flower', 'bud', 'seed'].map((name) => SEASONAL_PLANT_KINDS.findIndex((plant) => plant.kindName === name));
  let flowerStagesNeverOverlap = true;
  for (let yearStep = 0; yearStep <= 100; yearStep += 1) {
    const stateTable = seasonalStateForBothHemispheres(yearStep / 100, southernSeasonPhaseOf(yearStep / 100)).shaderTable;
    for (let flowerHash = 0; flowerHash < 1; flowerHash += 0.01) {
      let stagesShowing = 0;
      for (const kind of flowerKinds) {
        const at = kind * FLOATS_PER_SEASONAL_KIND;
        const upperEdge = stateTable[at + 4]!;
        const lowerEdge = stateTable[at + 6]!;
        if (!(flowerHash < lowerEdge || flowerHash >= upperEdge)) stagesShowing += 1;
      }
      if (stagesShowing > 1) flowerStagesNeverOverlap = false;
    }
  }

  const litterInAutumn = seasonalStateForBothHemispheres(LATE_AUTUMN, southernSeasonPhaseOf(LATE_AUTUMN)).leafLitter[0];
  const litterInSpring = seasonalStateForBothHemispheres(SPRING, southernSeasonPhaseOf(SPRING)).leafLitter[0];
  const berryRipeness = (yearFraction: number): number =>
    SEASONAL_PLANT_KINDS[seasonalKindIndexForSprite('bush.berries.v0.low')]!.stateAt(yearFraction).fruitRipeness;

  const results = [
    check(log, 'the kinds fit the shader table', SEASONAL_PLANT_KINDS.length <= SEASONAL_LIMIT),
    check(log, 'every kind encodes to the eight floats the shader reads',
      SEASONAL_PLANT_KINDS.every((plant) => encodeForShader(plant.stateAt(0.5)).length === FLOATS_PER_SEASONAL_KIND)),
    check(log, 'an oak is bare in the north at midwinter and in leaf in the south',
      northernOakInWinter > 0.8 && southernOakInWinter < 0.1),
    check(log, 'a flower is at most one of bud, bloom and seed head at any time of year', flowerStagesNeverOverlap),
    check(log, 'leaf litter lies in autumn and not in spring', litterInAutumn > 0.5 && litterInSpring === 0),
    check(log, 'berries ripen in late summer and are gone by winter', berryRipeness(0.55) > 0.9 && berryRipeness(0.9) === 0),
    check(log, 'sprites find their kind by name',
      seasonalKindIndexForSprite('meadow.flowers.red.bud.v1') !== seasonalKindIndexForSprite('meadow.flowers.red.v1') &&
        SEASONAL_PLANT_KINDS[seasonalKindIndexForSprite('forest.fern.v0')]!.kindName === 'fern' &&
        SEASONAL_PLANT_KINDS[seasonalKindIndexForSprite('tree.pine.v0.low')]!.kindName === 'evergreen'),
  ];

  const passed = results.every(Boolean);
  return { title: 'The seasons', passed, detail: passed ? 'each plant keeps its calendar' : 'a plant is out of season' };
}
