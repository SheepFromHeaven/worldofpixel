import type { Clouds } from './clouds.ts';
import { CLOUD_WATER_CAP } from './clouds.ts';
import type { GroundSurface } from './groundSurface.ts';
import type { Precipitation } from './precipitation.ts';
import type { Temperature } from './temperature.ts';
import type { Winds } from './winds.ts';
import { clampBetween } from './weatherMath.ts';
import type { WeatherGrid } from './weatherGrid.ts';

export const WIND_TEXTURE_RANGE_METRES_PER_SECOND = 25;
export const TEMPERATURE_TEXTURE_FLOOR_CELSIUS = -60;
export const TEMPERATURE_TEXTURE_SPAN_CELSIUS = 120;
export const PRESSURE_TEXTURE_RANGE = 3;

const toByte = (zeroToOne: number): number => Math.round(zeroToOne * 255);

export class WeatherTextures {
  readonly precipitationData: Uint8Array;
  readonly cloudData: Uint8Array;
  readonly fieldData: Uint8Array;
  readonly groundData: Uint8Array;
  readonly vapourData: Uint8Array;
  revision = 0;

  constructor(private readonly grid: WeatherGrid) {
    this.precipitationData = new Uint8Array(grid.cellCount * 4);
    this.cloudData = new Uint8Array(grid.cellCount * 4);
    this.fieldData = new Uint8Array(grid.cellCount * 4);
    this.groundData = new Uint8Array(grid.cellCount * 4);
    this.vapourData = new Uint8Array(grid.cellCount);
  }

  publish(
    clouds: Clouds,
    precipitation: Precipitation,
    temperature: Temperature,
    winds: Winds,
    ground: GroundSurface,
  ): void {
    for (let cell = 0; cell < this.grid.cellCount; cell += 1) {
      const at = cell * 4;

      this.precipitationData[at] = toByte(clouds.overcast[cell]!);
      this.precipitationData[at + 1] = toByte(precipitation.rain[cell]!);
      this.precipitationData[at + 2] = toByte(precipitation.snowfall[cell]!);
      this.precipitationData[at + 3] = toByte(precipitation.dust[cell]!);

      this.cloudData[at] = toByte(clampBetween(clouds.cloudWater[cell]! / CLOUD_WATER_CAP));
      this.cloudData[at + 1] = toByte(clouds.towering[cell]!);
      this.cloudData[at + 2] = toByte(clouds.layered[cell]!);
      this.cloudData[at + 3] = toByte(clouds.high[cell]!);

      const temperatureFraction =
        (temperature.surfaceTemperature[cell]! - TEMPERATURE_TEXTURE_FLOOR_CELSIUS) / TEMPERATURE_TEXTURE_SPAN_CELSIUS;
      this.fieldData[at] = toByte(clampBetween(temperatureFraction));
      this.fieldData[at + 1] = toByte(clampBetween((winds.pressure[cell]! / PRESSURE_TEXTURE_RANGE) * 0.5 + 0.5));
      this.fieldData[at + 2] = toByte(
        clampBetween((winds.windEastward[cell]! / WIND_TEXTURE_RANGE_METRES_PER_SECOND) * 0.5 + 0.5),
      );
      this.fieldData[at + 3] = toByte(
        clampBetween((winds.windSouthward[cell]! / WIND_TEXTURE_RANGE_METRES_PER_SECOND) * 0.5 + 0.5),
      );

      this.vapourData[cell] = toByte(clampBetween(clouds.vapour[cell]!));
      this.groundData[at] = toByte(ground.snowCover[cell]!);
      this.groundData[at + 1] = toByte(ground.wetness[cell]!);
      this.groundData[at + 2] = toByte(winds.galeStrength[cell]!);
      this.groundData[at + 3] = toByte(precipitation.thunder[cell]!);
    }
    this.revision += 1;
  }
}
