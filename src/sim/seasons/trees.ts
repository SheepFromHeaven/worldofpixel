import type { PlantSeasonState } from './seasonalPlant.ts';
import { SeasonalPlant } from './seasonalPlant.ts';
import { smoothBump, smoothstepBetween } from './seasonMath.ts';

export class EvergreenPlant extends SeasonalPlant {
  readonly kindName: string = 'evergreen';

  stateAt(): PlantSeasonState {
    return this.unchangedExcept({});
  }
}

export class DeciduousTree extends SeasonalPlant {
  readonly kindName: string = 'deciduous';
  protected readonly shareOfCanopyThatIsLost: number = 1;

  stateAt(yearFraction: number): PlantSeasonState {
    const isSpring = yearFraction < 0.3;
    const autumnColour = isSpring
      ? 1 - smoothstepBetween(0.0, 0.07, yearFraction)
      : smoothstepBetween(0.47, 0.62, yearFraction);
    const leafLoss = isSpring
      ? 1 - smoothstepBetween(0.02, 0.15, yearFraction)
      : smoothstepBetween(0.6, 0.86, yearFraction);
    const leavesFalling = smoothBump(yearFraction, 0.52, 0.9, 0.1);
    const litterOnGround = isSpring
      ? 0
      : smoothstepBetween(0.5, 0.74, yearFraction) * (1 - smoothstepBetween(0.76, 0.84, yearFraction));

    return this.unchangedExcept({
      autumnColour,
      leafLoss: leafLoss * this.shareOfCanopyThatIsLost,
      fallingLeavesPerSecond: leavesFalling * this.shareOfCanopyThatIsLost,
      leafLitterOnGround: litterOnGround * this.shareOfCanopyThatIsLost,
    });
  }
}

export class FloweringShrub extends DeciduousTree {
  override readonly kindName: string = 'shrub';
  protected override readonly shareOfCanopyThatIsLost: number = 0.55;

  override stateAt(yearFraction: number): PlantSeasonState {
    const leafState = super.stateAt(yearFraction);
    const springBlossom = smoothBump(yearFraction, 0.02, 0.2, 0.05);
    return { ...leafState, blossomAmount: springBlossom, blowingPetalsPerSecond: springBlossom };
  }
}

export class BerryBush extends FloweringShrub {
  override readonly kindName: string = 'berry';

  override stateAt(yearFraction: number): PlantSeasonState {
    const shrubState = super.stateAt(yearFraction);
    const fruitRipeness =
      smoothstepBetween(0.36, 0.48, yearFraction) * (1 - smoothstepBetween(0.72, 0.82, yearFraction));
    return { ...shrubState, fruitRipeness };
  }
}
