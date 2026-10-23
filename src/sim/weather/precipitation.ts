import type { Weather } from '../terrain/weather.ts';
import type { ForcedWeather } from './forcedWeather.ts';
import { forcedDust } from './forcedWeather.ts';
import { drynessOfCell } from './temperature.ts';
import type { Winds } from './winds.ts';
import { clampBetween, smoothstepBetween } from './weatherMath.ts';
import type { WeatherGrid } from './weatherGrid.ts';

export class Precipitation {
  readonly rain: Float32Array;
  readonly snowfall: Float32Array;
  readonly thunder: Float32Array;
  readonly dust: Float32Array;

  constructor(
    private readonly grid: WeatherGrid,
    private readonly weather: Weather,
  ) {
    this.rain = grid.createCellArray();
    this.snowfall = grid.createCellArray();
    this.thunder = grid.createCellArray();
    this.dust = grid.createCellArray();
  }

  compute(
    forced: ForcedWeather | null,
    overcast: Float32Array,
    towering: Float32Array,
    surfaceTemperature: Float32Array,
    winds: Winds,
  ): void {
    for (let cell = 0; cell < this.grid.cellCount; cell += 1) {
      const naturalDust =
        smoothstepBetween(5, 11, winds.windSpeed[cell]!) *
        drynessOfCell(this.weather.humid[cell]!) *
        smoothstepBetween(0.35, 0.65, winds.gustNoise[cell]!);
      this.dust[cell] = forcedDust(forced, naturalDust, winds.gustNoise[cell]!);

      const temperature = surfaceTemperature[cell]!;
      const fallingAmount = smoothstepBetween(0.25, 0.75, overcast[cell]!);
      const frozenShare = clampBetween((1.5 - temperature) / 1.5);
      this.rain[cell] = fallingAmount * (1 - frozenShare);
      this.snowfall[cell] = fallingAmount * frozenShare;

      const toweringHere = towering[cell]!;
      this.thunder[cell] = toweringHere > 0.4 && temperature > 8 ? smoothstepBetween(0.4, 0.8, toweringHere) : 0;
    }
  }
}
