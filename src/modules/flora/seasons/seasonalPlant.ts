export type PlantVisibility =
  | { kind: 'fractionOfTexelsKept'; fraction: number }
  | { kind: 'wholeSpriteInterval'; fromFraction: number; toFraction: number };

export interface PlantSeasonState {
  autumnColour: number;
  leafLoss: number;
  fruitRipeness: number;
  blossomAmount: number;
  strawDryness: number;
  visibility: PlantVisibility;
  fallingLeavesPerSecond: number;
  blowingPetalsPerSecond: number;
  leafLitterOnGround: number;
}

const FULLY_VISIBLE: PlantVisibility = { kind: 'fractionOfTexelsKept', fraction: 1 };

export const UNCHANGED_BY_SEASON: PlantSeasonState = {
  autumnColour: 0,
  leafLoss: 0,
  fruitRipeness: 0,
  blossomAmount: 0,
  strawDryness: 0,
  visibility: FULLY_VISIBLE,
  fallingLeavesPerSecond: 0,
  blowingPetalsPerSecond: 0,
  leafLitterOnGround: 0,
};

export abstract class SeasonalPlant {
  abstract readonly kindName: string;

  abstract stateAt(yearFraction: number): PlantSeasonState;

  protected unchangedExcept(changes: Partial<PlantSeasonState>): PlantSeasonState {
    return { ...UNCHANGED_BY_SEASON, ...changes };
  }
}
