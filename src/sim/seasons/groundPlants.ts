import type { PlantSeasonState } from './seasonalPlant.ts';
import { SeasonalPlant } from './seasonalPlant.ts';
import { smoothBump, smoothstepBetween } from './seasonMath.ts';

export class Grass extends SeasonalPlant {
  readonly kindName = 'grass';

  stateAt(yearFraction: number): PlantSeasonState {
    const isSpring = yearFraction < 0.3;
    const dryness = isSpring
      ? 1 - smoothstepBetween(0.0, 0.1, yearFraction)
      : smoothstepBetween(0.5, 0.7, yearFraction);
    return this.unchangedExcept({ strawDryness: dryness, autumnColour: dryness });
  }
}

export class Fern extends SeasonalPlant {
  readonly kindName = 'fern';

  stateAt(yearFraction: number): PlantSeasonState {
    const winterDieBack =
      smoothstepBetween(0.7, 0.85, yearFraction) * (1 - smoothstepBetween(0.95, 1.0, yearFraction));
    const springRegrowth = yearFraction < 0.2 ? 1 - smoothstepBetween(0.0, 0.14, yearFraction) : 0;
    return this.unchangedExcept({
      visibility: {
        kind: 'fractionOfTexelsKept',
        fraction: 1 - 0.85 * Math.max(winterDieBack, springRegrowth),
      },
      autumnColour: smoothstepBetween(0.5, 0.7, yearFraction) * 0.5,
    });
  }
}

interface FlowerStageWindow {
  fromFraction: number;
  toFraction: number;
}

const budsHaveSprouted = (yearFraction: number): number => smoothstepBetween(0.0, 0.08, yearFraction);
const budsHaveOpened = (yearFraction: number): number => smoothstepBetween(0.05, 0.15, yearFraction);
const bloomsHaveWithered = (yearFraction: number): number => smoothstepBetween(0.42, 0.56, yearFraction);
const seedHeadsHaveGone = (yearFraction: number): number => smoothstepBetween(0.6, 0.72, yearFraction);

abstract class FlowerStage extends SeasonalPlant {
  protected abstract windowAt(yearFraction: number): FlowerStageWindow;

  stateAt(yearFraction: number): PlantSeasonState {
    const { fromFraction, toFraction } = this.windowAt(yearFraction);
    return this.unchangedExcept({
      visibility: { kind: 'wholeSpriteInterval', fromFraction, toFraction },
      blowingPetalsPerSecond: smoothBump(yearFraction, 0.04, 0.4, 0.08) * 0.6,
    });
  }
}

export class FlowerInBloom extends FlowerStage {
  readonly kindName = 'flower';

  protected windowAt(yearFraction: number): FlowerStageWindow {
    return { fromFraction: bloomsHaveWithered(yearFraction), toFraction: budsHaveOpened(yearFraction) };
  }
}

export class FlowerBud extends FlowerStage {
  readonly kindName = 'bud';

  protected windowAt(yearFraction: number): FlowerStageWindow {
    return { fromFraction: budsHaveOpened(yearFraction), toFraction: budsHaveSprouted(yearFraction) };
  }
}

export class FlowerSeedHead extends FlowerStage {
  readonly kindName = 'seed';

  override stateAt(yearFraction: number): PlantSeasonState {
    return { ...super.stateAt(yearFraction), strawDryness: 1, autumnColour: 1, blowingPetalsPerSecond: 0 };
  }

  protected windowAt(yearFraction: number): FlowerStageWindow {
    return { fromFraction: seedHeadsHaveGone(yearFraction), toFraction: bloomsHaveWithered(yearFraction) };
  }
}
