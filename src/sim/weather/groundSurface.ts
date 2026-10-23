import { clampBetween } from './weatherMath.ts';
import type { WeatherGrid } from './weatherGrid.ts';

export class GroundSurface {
  readonly wetness: Float32Array;
  readonly snowCover: Float32Array;

  constructor(grid: WeatherGrid) {
    this.wetness = grid.createCellArray();
    this.snowCover = grid.createCellArray();
  }

  integrate(
    elapsedDays: number,
    cellCount: number,
    rain: Float32Array,
    snowfall: Float32Array,
    surfaceTemperature: Float32Array,
  ): void {
    for (let cell = 0; cell < cellCount; cell += 1) {
      const temperature = surfaceTemperature[cell]!;

      let wetness = this.wetness[cell]! + rain[cell]! * elapsedDays * 6;
      wetness -= elapsedDays * (0.9 + Math.max(0, temperature - 10) * 0.05);

      let snow = this.snowCover[cell]! + snowfall[cell]! * elapsedDays * 1.3;
      const meltCapacity = (Math.max(0, temperature - 0.5) * 0.35 + rain[cell]! * 0.4) * elapsedDays;
      const melted = Math.min(snow, meltCapacity);
      snow -= melted;
      wetness += melted * 1.5;

      this.wetness[cell] = clampBetween(wetness);
      this.snowCover[cell] = clampBetween(snow);
    }
  }
}
