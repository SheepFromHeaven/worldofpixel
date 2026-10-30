import { Fern, FlowerBud, FlowerInBloom, FlowerSeedHead, Grass } from './groundPlants.ts';
import type { PlantSeasonState } from './seasonalPlant.ts';
import type { SeasonalPlant } from './seasonalPlant.ts';
import { BerryBush, DeciduousTree, EvergreenPlant, FloweringShrub } from './trees.ts';

export const SEASONAL_PLANT_KINDS: readonly SeasonalPlant[] = [
  new EvergreenPlant(),
  new DeciduousTree(),
  new FloweringShrub(),
  new BerryBush(),
  new Grass(),
  new FlowerInBloom(),
  new FlowerBud(),
  new FlowerSeedHead(),
  new Fern(),
];

export const SEASONAL_LIMIT = 12;
export const FLOATS_PER_SEASONAL_KIND = 8;

export function seasonalKindIndexForSprite(spriteName: string): number {
  const kindIndex = (kindName: string): number =>
    SEASONAL_PLANT_KINDS.findIndex((plant) => plant.kindName === kindName);

  if (/^tree\.(oak|birch|chestnut|apple|willow)(\.|$)/.test(spriteName)) return kindIndex('deciduous');
  if (/^bush\.(berry|grapevine)(\.|$)/.test(spriteName)) return kindIndex('berry');
  if (/^bush\.(shrub)(\.|$)/.test(spriteName)) return kindIndex('shrub');
  if (/^bush\.fern(\.|$)/.test(spriteName)) return kindIndex('fern');
  if (/^(meadow\.flowers|desert\.flower|aqua\.(lily|algae))/.test(spriteName)) {
    if (/\.bud\.v\d+$/.test(spriteName)) return kindIndex('bud');
    if (/\.seed\.v\d+$/.test(spriteName)) return kindIndex('seed');
    return kindIndex('flower');
  }
  if (/^(highland\.heather|meadow\.tuft|meadow\.clover|highland\.tussock|herb\.(savannagrass|steppegrass|tussock|dunegrass|desertgrass|sedge)|marsh\.|desert\.scrub|aqua\.(reeds|weed))/.test(spriteName)) {
    return kindIndex('grass');
  }
  if (spriteName.startsWith('forest.fern')) return kindIndex('fern');
  return kindIndex('evergreen');
}

export interface SeasonalState {
  shaderTable: Float32Array;
  fallingLeaves: readonly [number, number];
  blowingPetals: readonly [number, number];
  leafLitter: readonly [number, number];
}

const FLOATS_PER_HEMISPHERE = SEASONAL_LIMIT * FLOATS_PER_SEASONAL_KIND;

export function encodeForShader(state: PlantSeasonState): readonly number[] {
  const { visibility } = state;
  const isWholeSprite = visibility.kind === 'wholeSpriteInterval';
  return [
    state.autumnColour,
    state.leafLoss,
    state.fruitRipeness,
    state.blossomAmount,
    isWholeSprite ? visibility.toFraction : visibility.fraction,
    state.strawDryness,
    isWholeSprite ? visibility.fromFraction : 0,
    isWholeSprite ? 1 : 0,
  ];
}

export function seasonalStateForBothHemispheres(northernYearFraction: number, southernYearFraction: number): SeasonalState {
  const shaderTable = new Float32Array(FLOATS_PER_HEMISPHERE * 2);
  const fallingLeaves: [number, number] = [0, 0];
  const blowingPetals: [number, number] = [0, 0];
  const leafLitter: [number, number] = [0, 0];

  [northernYearFraction, southernYearFraction].forEach((yearFraction, hemisphere) => {
    SEASONAL_PLANT_KINDS.forEach((plant, kindIndex) => {
      const state = plant.stateAt(yearFraction);
      shaderTable.set(
        encodeForShader(state),
        hemisphere * FLOATS_PER_HEMISPHERE + kindIndex * FLOATS_PER_SEASONAL_KIND,
      );
      fallingLeaves[hemisphere] = Math.max(fallingLeaves[hemisphere]!, state.fallingLeavesPerSecond);
      blowingPetals[hemisphere] = Math.max(blowingPetals[hemisphere]!, state.blowingPetalsPerSecond);
      leafLitter[hemisphere] = Math.max(leafLitter[hemisphere]!, state.leafLitterOnGround);
    });
  });

  return { shaderTable, fallingLeaves, blowingPetals, leafLitter };
}
