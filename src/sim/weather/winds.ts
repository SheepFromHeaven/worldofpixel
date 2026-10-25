import type { TileGrid } from '../grid.ts';
import { zonalFlow } from '../terrain/climate.ts';
import type { Weather } from '../terrain/weather.ts';
import { WEATHER_STEP } from '../terrain/weather.ts';
import type { PressureCentre } from './pressureCentres.ts';
import { findPressureCentres } from './pressureCentres.ts';
import { seasonalTemperatureSwing, yearlyTemperatureCycle } from './temperature.ts';
import { clampBetween, smoothstepBetween, smoothValueNoise } from './weatherMath.ts';
import type { WeatherGrid } from './weatherGrid.ts';

export const PRESSURE_BELT_SHIFT_DEGREES = 9;

const TILES_PER_DAY_NOISE_DRIFT = 160;
const NOISE_CROSS_FADE_PERIOD_DAYS = 1;
const PRESSURE_GRADIENT_WIND_GAIN = 30;
const SURFACE_FRICTION = 0.4;
const ZONAL_FLOW_WIND_GAIN = 5;
const THERMAL_LOW_PER_CELSIUS = 0.03;
const REFERENCE_AIR_CELSIUS = 15;
const ZONAL_PRESSURE_AMPLITUDE = 0.55;

export const zonalPressureAt = (beltLatitude: number): number =>
  ZONAL_PRESSURE_AMPLITUDE * -Math.cos((6 * (beltLatitude * Math.PI)) / 180);

export const coriolisStrengthAt = (latitudeDegrees: number): number =>
  clampBetween(Math.sin((latitudeDegrees * Math.PI) / 180) * 4, -1, 1);

export class Winds {
  readonly pressure: Float32Array;
  readonly pressureAnomaly: Float32Array;
  readonly pressureContrast: Float32Array;
  readonly windEastward: Float32Array;
  readonly windSouthward: Float32Array;
  readonly windSpeed: Float32Array;
  readonly galeStrength: Float32Array;
  readonly stormCore: Float32Array;
  readonly gustNoise: Float32Array;
  pressureCentres: PressureCentre[] = [];

  private readonly noiseSeedOffset: number;

  constructor(
    private readonly grid: WeatherGrid,
    private readonly tileGrid: TileGrid,
    private readonly weather: Weather,
    worldSeed: number,
  ) {
    this.pressure = grid.createCellArray();
    this.pressureAnomaly = grid.createCellArray();
    this.pressureContrast = grid.createCellArray();
    this.windEastward = grid.createCellArray();
    this.windSouthward = grid.createCellArray();
    this.windSpeed = grid.createCellArray();
    this.galeStrength = grid.createCellArray();
    this.stormCore = grid.createCellArray();
    this.gustNoise = grid.createCellArray();
    this.noiseSeedOffset = (worldSeed % 9973) * 0.37;
  }

  update(timeInDays: number, seasonPhase: number): void {
    const yearlyCycle = yearlyTemperatureCycle(seasonPhase);
    this.computePressure(timeInDays, yearlyCycle);
    this.pressureCentres = findPressureCentres(this.grid, this.tileGrid, this.pressureAnomaly);
    this.computeWindFromPressure(yearlyCycle);
  }

  deriveGale(thunderStrength: Float32Array, dustStrength: Float32Array): void {
    for (let cell = 0; cell < this.grid.cellCount; cell += 1) {
      this.galeStrength[cell] = Math.max(
        smoothstepBetween(6, 18, this.windSpeed[cell]!),
        thunderStrength[cell]! * 0.5,
        dustStrength[cell]! * 0.85,
      );
    }
  }

  private computePressure(timeInDays: number, yearlyCycle: number): void {
    const cyclePosition = timeInDays / NOISE_CROSS_FADE_PERIOD_DAYS;
    const firstLayerCycle = Math.floor(cyclePosition);
    const secondLayerCycle = Math.floor(cyclePosition + 0.5);
    const firstLayerAge = (cyclePosition - firstLayerCycle) * NOISE_CROSS_FADE_PERIOD_DAYS;
    const secondLayerAge = (cyclePosition + 0.5 - secondLayerCycle) * NOISE_CROSS_FADE_PERIOD_DAYS;
    const firstLayerWeight = 1 - Math.abs(2 * (cyclePosition - firstLayerCycle) - 1);
    const secondLayerWeight = 1 - firstLayerWeight;
    const weightNormaliser = Math.hypot(firstLayerWeight, secondLayerWeight);

    for (let row = 0; row < this.grid.rows; row += 1) {
      for (let column = 0; column < this.grid.columns; column += 1) {
        const cell = this.grid.cellIndex(column, row);
        const latitude = this.weather.latitude[cell]!;
        const beltLatitude = latitude - PRESSURE_BELT_SHIFT_DEGREES * yearlyCycle;
        const eastwardDriftPerDay = zonalFlow(beltLatitude);

        const sampleLayer = (layerAgeDays: number, layerCycle: number) => {
          const x = column * WEATHER_STEP + WEATHER_STEP / 2 - eastwardDriftPerDay * layerAgeDays * TILES_PER_DAY_NOISE_DRIFT;
          const y = row * WEATHER_STEP + WEATHER_STEP / 2 - layerAgeDays * TILES_PER_DAY_NOISE_DRIFT * 0.05;
          const layerSalt = this.noiseSeedOffset + layerCycle * 13.7;
          const broadNoise = smoothValueNoise(x / 700, y / 700, layerSalt + 3);
          const mediumNoise = smoothValueNoise(x / 300, y / 300, layerSalt + 1);
          const fineNoise = smoothValueNoise(x / 130 + layerAgeDays * 0.4, y / 130 - layerAgeDays * 0.3, layerSalt + 2);
          return {
            pressureAnomaly: (broadNoise * 0.3 + mediumNoise * 0.45 + fineNoise * 0.25 - 0.5) * 6,
            fineNoise,
            stormCore: smoothValueNoise(x / 90, y / 90 + layerAgeDays * 0.2, layerSalt + 9),
          };
        };
        const firstLayer = sampleLayer(firstLayerAge, firstLayerCycle);
        const secondLayer = sampleLayer(secondLayerAge, secondLayerCycle);

        const noiseAnomaly =
          (firstLayer.pressureAnomaly * firstLayerWeight + secondLayer.pressureAnomaly * secondLayerWeight) /
          weightNormaliser;
        this.gustNoise[cell] = firstLayer.fineNoise * firstLayerWeight + secondLayer.fineNoise * secondLayerWeight;
        this.stormCore[cell] = firstLayer.stormCore * firstLayerWeight + secondLayer.stormCore * secondLayerWeight;

        const waterShare = clampBetween(this.weather.standing[cell]!);
        const seasonalWarming = yearlyCycle * seasonalTemperatureSwing(latitude, waterShare);
        const thermalLow =
          THERMAL_LOW_PER_CELSIUS * (this.weather.warmth[cell]! + seasonalWarming - REFERENCE_AIR_CELSIUS);
        const zonalBase = zonalPressureAt(beltLatitude);

        this.pressure[cell] = zonalBase + noiseAnomaly - thermalLow;
        this.pressureAnomaly[cell] = noiseAnomaly - thermalLow;
      }
    }
  }

  private computeWindFromPressure(yearlyCycle: number): void {
    for (let row = 0; row < this.grid.rows; row += 1) {
      for (let column = 0; column < this.grid.columns; column += 1) {
        const cell = this.grid.cellIndex(column, row);

        const pressureSlopeEast =
          (this.grid.valueAtClamped(this.pressure, column + 1, row) - this.grid.valueAtClamped(this.pressure, column - 1, row)) / 2;
        const pressureSlopeSouth =
          (this.grid.valueAtClamped(this.pressure, column, row + 1) - this.grid.valueAtClamped(this.pressure, column, row - 1)) / 2;
        this.pressureContrast[cell] = Math.hypot(pressureSlopeEast, pressureSlopeSouth);

        const coriolisStrength = coriolisStrengthAt(this.weather.latitude[cell]!);
        const geostrophicShare = Math.abs(coriolisStrength);
        const turnDirection = coriolisStrength >= 0 ? 1 : -1;
        const geostrophicEast = turnDirection * pressureSlopeSouth;
        const geostrophicSouth = -turnDirection * pressureSlopeEast;
        const terrainExposure = 0.55 + 0.9 * this.weather.gale[cell]!;
        const beltLatitude = this.weather.latitude[cell]! - PRESSURE_BELT_SHIFT_DEGREES * yearlyCycle;

        const windEast =
          (PRESSURE_GRADIENT_WIND_GAIN *
            (geostrophicShare * geostrophicEast - (1 - geostrophicShare + SURFACE_FRICTION) * pressureSlopeEast) +
            zonalFlow(beltLatitude) * ZONAL_FLOW_WIND_GAIN) *
          terrainExposure;
        const windSouth =
          PRESSURE_GRADIENT_WIND_GAIN *
          (geostrophicShare * geostrophicSouth - (1 - geostrophicShare + SURFACE_FRICTION) * pressureSlopeSouth) *
          terrainExposure;

        this.windEastward[cell] = windEast;
        this.windSouthward[cell] = windSouth;
        this.windSpeed[cell] = Math.hypot(windEast, windSouth);
      }
    }
  }
}
