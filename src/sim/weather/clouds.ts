import type { Weather } from '../terrain/weather.ts';
import { WEATHER_STEP } from '../terrain/weather.ts';
import type { ForcedWeather } from './forcedWeather.ts';
import { forcedCloudWater, forcedOvercast } from './forcedWeather.ts';
import type { Winds } from './winds.ts';
import { clampBetween, smoothstepBetween } from './weatherMath.ts';
import type { WeatherGrid } from './weatherGrid.ts';

export const CLOUD_WATER_CAP = 1.6;

const VAPOUR_CAP = 1.4;
const WIND_DRIFT_TILES_PER_METRE_PER_SECOND_PER_DAY = 30;
const ADVECT_EVERY_DAYS = 1 / 40;
const RAIN_DRAINS_CLOUD_PER_DAY = 2.6;
const CONDENSATION_RATE_PER_DAY = 8;
const REEVAPORATION_RATE_PER_DAY = 6;
const CLOUD_DISSIPATION_PER_DAY = 0.15;
const SINKING_AIR_CLOUD_LOSS_PER_DAY = 1.2;
const SINKING_AIR_VAPOUR_LOSS_PER_DAY = 0.8;
const INITIAL_VAPOUR_SHARE_OF_SATURATION = 0.75;

export const saturationVapour = (celsius: number): number =>
  0.18 * Math.exp(0.055 * Math.max(-12, Math.min(40, celsius)));

export class Clouds {
  readonly vapour: Float32Array;
  readonly cloudWater: Float32Array;
  readonly lift: Float32Array;
  readonly overcast: Float32Array;
  readonly towering: Float32Array;
  readonly layered: Float32Array;
  readonly high: Float32Array;

  private daysSinceAdvection = 0;

  constructor(
    private readonly grid: WeatherGrid,
    private readonly weather: Weather,
  ) {
    this.vapour = grid.createCellArray();
    this.cloudWater = grid.createCellArray();
    this.lift = grid.createCellArray();
    this.overcast = grid.createCellArray();
    this.towering = grid.createCellArray();
    this.layered = grid.createCellArray();
    this.high = grid.createCellArray();
  }

  fillInitialVapour(airTemperature: Float32Array): void {
    for (let cell = 0; cell < this.grid.cellCount; cell += 1) {
      this.vapour[cell] = INITIAL_VAPOUR_SHARE_OF_SATURATION * saturationVapour(airTemperature[cell]!);
    }
  }

  computeLift(winds: Winds, airTemperature: Float32Array): void {
    for (let row = 0; row < this.grid.rows; row += 1) {
      for (let column = 0; column < this.grid.columns; column += 1) {
        const cell = this.grid.cellIndex(column, row);
        const lowPressureLift = clampBetween(-winds.pressure[cell]! / 1.5);

        const altitudeSlopeEast =
          (this.grid.valueAtClamped(this.weather.altitude, column + 1, row) -
            this.grid.valueAtClamped(this.weather.altitude, column - 1, row)) / 2;
        const altitudeSlopeSouth =
          (this.grid.valueAtClamped(this.weather.altitude, column, row + 1) -
            this.grid.valueAtClamped(this.weather.altitude, column, row - 1)) / 2;
        const windUpTheSlope = Math.max(
          0,
          winds.windEastward[cell]! * altitudeSlopeEast + winds.windSouthward[cell]! * altitudeSlopeSouth,
        );
        const forcedUpSlopeLift = clampBetween(windUpTheSlope * 4);

        const lowPressureShare = 1 - clampBetween(winds.pressure[cell]! / 1.5);
        const surfaceHeatingLift = clampBetween((airTemperature[cell]! - 14) / 16) * (0.55 + 0.45 * lowPressureShare);

        this.lift[cell] = clampBetween(0.6 * lowPressureLift + 0.7 * forcedUpSlopeLift + 0.55 * surfaceHeatingLift);
      }
    }
  }

  computeOvercast(forced: ForcedWeather | null): void {
    for (let cell = 0; cell < this.grid.cellCount; cell += 1) {
      const naturalOvercast = smoothstepBetween(0.3, 1.1, this.cloudWater[cell]!);
      this.overcast[cell] = forcedOvercast(forced, naturalOvercast);
    }
  }

  classifyCloudKinds(forcedTemperature: Float32Array, winds: Winds): void {
    for (let cell = 0; cell < this.grid.cellCount; cell += 1) {
      const water = this.cloudWater[cell]!;
      const pressure = winds.pressure[cell]!;
      const lowPressureLift = clampBetween(-pressure / 1.5);
      const convectiveness = clampBetween((forcedTemperature[cell]! - 10) / 18);

      const towering = smoothstepBetween(0.6, 1.0, water) * clampBetween(0.25 + 1.1 * convectiveness);
      const stableAir = clampBetween(1 - convectiveness * 1.3 + clampBetween(pressure / 2) * 0.4);
      this.towering[cell] = towering;
      this.layered[cell] = smoothstepBetween(0.2, 0.7, water) * stableAir * (1 - towering);
      this.high[cell] =
        clampBetween(0.18 + 0.5 * lowPressureLift + 0.3 * clampBetween(winds.windSpeed[cell]! / 16)) *
        (1 - 0.75 * clampBetween(water));
    }
  }

  form(
    elapsedDays: number,
    forced: ForcedWeather | null,
    airTemperature: Float32Array,
    winds: Winds,
    groundWetness: Float32Array,
  ): void {
    for (let cell = 0; cell < this.grid.cellCount; cell += 1) {
      const saturationAtThisTemperature = saturationVapour(airTemperature[cell]!);
      const sinkingAir = clampBetween(winds.pressure[cell]! / 1.5);
      const liftHere = this.lift[cell]!;

      const standingWaterShare = this.weather.standing[cell]!;
      const evaporationSource =
        (0.85 * standingWaterShare +
          0.3 * (1 - standingWaterShare) * this.weather.humid[cell]! +
          0.25 * groundWetness[cell]! * (1 - standingWaterShare)) *
        saturationAtThisTemperature *
        (1 + 0.04 * winds.windSpeed[cell]!) *
        0.9;

      let vapour = this.vapour[cell]! + evaporationSource * elapsedDays;
      let water = this.cloudWater[cell]!;

      const latentHeatFeeding = 0.55 * smoothstepBetween(0.4, 0.8, water) * liftHere * liftHere;
      const condensationThreshold = saturationAtThisTemperature * (1 - 0.55 * liftHere - latentHeatFeeding);
      if (vapour > condensationThreshold) {
        const condensed = (vapour - condensationThreshold) * Math.min(1, CONDENSATION_RATE_PER_DAY * elapsedDays);
        vapour -= condensed;
        water += condensed;
      } else {
        const evaporated = Math.min(
          water,
          (condensationThreshold - vapour) * Math.min(1, REEVAPORATION_RATE_PER_DAY * elapsedDays),
        );
        water -= evaporated;
        vapour += evaporated;
      }

      const rainingHeaviness = smoothstepBetween(0.25, 0.75, smoothstepBetween(0.3, 1.1, water));
      water -= Math.min(water, rainingHeaviness * water * RAIN_DRAINS_CLOUD_PER_DAY * elapsedDays);
      water -= water * CLOUD_DISSIPATION_PER_DAY * elapsedDays;
      water -= water * sinkingAir * SINKING_AIR_CLOUD_LOSS_PER_DAY * elapsedDays;
      vapour -= vapour * sinkingAir * SINKING_AIR_VAPOUR_LOSS_PER_DAY * elapsedDays;

      water = forcedCloudWater(forced, water);

      this.vapour[cell] = Math.max(0, Math.min(VAPOUR_CAP, vapour));
      this.cloudWater[cell] = Math.max(0, Math.min(CLOUD_WATER_CAP, water));
    }

    this.daysSinceAdvection += elapsedDays;
    if (this.daysSinceAdvection >= ADVECT_EVERY_DAYS) {
      this.carryAlongWithWind(this.daysSinceAdvection, winds);
      this.daysSinceAdvection = 0;
    }
  }

  private carryAlongWithWind(elapsedDays: number, winds: Winds): void {
    const cellsTravelledPerMetrePerSecond =
      (WIND_DRIFT_TILES_PER_METRE_PER_SECOND_PER_DAY * elapsedDays) / WEATHER_STEP;
    const carriedCloudWater = this.grid.createCellArray();
    const carriedVapour = this.grid.createCellArray();

    for (let row = 0; row < this.grid.rows; row += 1) {
      for (let column = 0; column < this.grid.columns; column += 1) {
        const cell = this.grid.cellIndex(column, row);
        const upwindColumn = column - winds.windEastward[cell]! * cellsTravelledPerMetrePerSecond;
        const upwindRow = row - winds.windSouthward[cell]! * cellsTravelledPerMetrePerSecond;
        carriedCloudWater[cell] = this.grid.bilinearSample(this.cloudWater, upwindColumn, upwindRow);
        carriedVapour[cell] = this.grid.bilinearSample(this.vapour, upwindColumn, upwindRow);
      }
    }

    this.cloudWater.set(carriedCloudWater);
    this.vapour.set(carriedVapour);
  }
}
