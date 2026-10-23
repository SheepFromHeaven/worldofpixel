import { dayFractionOffsetAtMapPosition } from '../astro.ts';
import type { Weather } from '../terrain/weather.ts';
import type { ForcedWeather } from './forcedWeather.ts';
import { forcedAirTemperature } from './forcedWeather.ts';
import { clampBetween, smoothstepBetween } from './weatherMath.ts';
import type { WeatherGrid } from './weatherGrid.ts';

export const SEASONAL_SWING_CELSIUS = 24;

const SUMMER_PEAK_SEASON_PHASE = 0.375;
const WARMEST_TIME_OF_DAY = 0.58;
const OVERCAST_COOLING_CELSIUS = 2;

export const yearlyTemperatureCycle = (seasonPhase: number): number =>
  Math.cos(2 * Math.PI * (seasonPhase - SUMMER_PEAK_SEASON_PHASE));

export function seasonalTemperatureSwing(latitudeDegrees: number, waterShare: number): number {
  const hemisphereSign = latitudeDegrees >= 0 ? 1 : -1;
  const latitudeStrength = Math.min(1, Math.max(0.1, Math.abs(latitudeDegrees) / 55));
  const continentality = 0.25 + 0.75 * (1 - waterShare);
  return hemisphereSign * latitudeStrength * SEASONAL_SWING_CELSIUS * continentality;
}

export function dailyTemperatureSwing(waterShare: number, dryness: number): number {
  return 1.5 + 9 * (1 - waterShare) * (0.35 + 0.65 * dryness);
}

export const drynessOfCell = (humidity: number): number => 1 - smoothstepBetween(0.12, 0.4, humidity);

export class Temperature {
  readonly airTemperature: Float32Array;
  readonly forcedTemperature: Float32Array;
  readonly surfaceTemperature: Float32Array;

  constructor(
    private readonly grid: WeatherGrid,
    private readonly weather: Weather,
  ) {
    this.airTemperature = grid.createCellArray();
    this.forcedTemperature = grid.createCellArray();
    this.surfaceTemperature = grid.createCellArray();
  }

  computeAirTemperature(timeOfDay: number, seasonPhase: number): void {
    const yearlyCycle = yearlyTemperatureCycle(seasonPhase);
    for (let row = 0; row < this.grid.rows; row += 1) {
      for (let column = 0; column < this.grid.columns; column += 1) {
        const cell = this.grid.cellIndex(column, row);
        const latitude = this.weather.latitude[cell]!;
        const waterShare = clampBetween(this.weather.standing[cell]!);
        const dryness = drynessOfCell(this.weather.humid[cell]!);
        const localTimeOfDay = timeOfDay + dayFractionOffsetAtMapPosition((column + 0.5) / this.grid.columns);
        const dailyCycle = Math.cos(2 * Math.PI * (localTimeOfDay - WARMEST_TIME_OF_DAY));
        this.airTemperature[cell] =
          this.weather.warmth[cell]! +
          dailyTemperatureSwing(waterShare, dryness) * dailyCycle +
          yearlyCycle * seasonalTemperatureSwing(latitude, waterShare);
      }
    }
  }

  applyForcedWeather(forced: ForcedWeather | null): void {
    for (let cell = 0; cell < this.grid.cellCount; cell += 1) {
      this.forcedTemperature[cell] = forcedAirTemperature(forced, this.airTemperature[cell]!);
    }
  }

  coolUnderOvercast(overcast: Float32Array): void {
    for (let cell = 0; cell < this.grid.cellCount; cell += 1) {
      this.surfaceTemperature[cell] = this.forcedTemperature[cell]! - OVERCAST_COOLING_CELSIUS * overcast[cell]!;
    }
  }
}
