import type { Bolt } from './lightning.ts';
import type { PressureCentre } from './pressureCentres.ts';
import {
  PRESSURE_TEXTURE_RANGE,
  TEMPERATURE_TEXTURE_FLOOR_CELSIUS,
  TEMPERATURE_TEXTURE_SPAN_CELSIUS,
  WIND_TEXTURE_RANGE_METRES_PER_SECOND,
} from './weatherTextures.ts';
import { CLOUD_WATER_CAP } from './clouds.ts';
import type { WeatherGrid } from './weatherGrid.ts';

export interface SkyBytes {
  precipitationData: Uint8Array;
  cloudData: Uint8Array;
  fieldData: Uint8Array;
  groundData: Uint8Array;
  vapourData: Uint8Array;
  revision: number;
}

export interface LightningView {
  readonly recentBolts: readonly Bolt[];
  readonly dischargeCount: number;
  readonly groundStrikeCount: number;
  readonly latestGroundStrike: { x: number; y: number };
}

export interface SkyView {
  readonly grid: WeatherGrid;
  readonly textures: SkyBytes;
  readonly pressureCentres: readonly PressureCentre[];
  readonly lightning: LightningView;
  cellContainingTile(tileColumn: number, tileRow: number): number;
}

export interface SkyFrame {
  precipitationData: Uint8Array;
  cloudData: Uint8Array;
  fieldData: Uint8Array;
  groundData: Uint8Array;
  vapourData: Uint8Array;
  revision: number;
  pressureCentres: PressureCentre[];
  recentBolts: Bolt[];
  dischargeCount: number;
  groundStrikeCount: number;
  latestGroundStrike: { x: number; y: number };
}

export interface CellWeather {
  overcast: number;
  rain: number;
  snowfall: number;
  dust: number;
  cloudWater: number;
  towering: number;
  layered: number;
  high: number;
  vapour: number;
  temperature: number;
  pressure: number;
  windEast: number;
  windSouth: number;
  windSpeed: number;
  snowCover: number;
  wetness: number;
  gale: number;
  thunder: number;
}

const unit = (byte: number | undefined): number => (byte ?? 0) / 255;

export function readCell(view: SkyView, cell: number): CellWeather {
  const { precipitationData: p, cloudData: c, fieldData: f, groundData: g, vapourData: v } = view.textures;
  const at = cell * 4;
  const windEast = (unit(f[at + 2]) * 2 - 1) * WIND_TEXTURE_RANGE_METRES_PER_SECOND;
  const windSouth = (unit(f[at + 3]) * 2 - 1) * WIND_TEXTURE_RANGE_METRES_PER_SECOND;
  return {
    overcast: unit(p[at]),
    rain: unit(p[at + 1]),
    snowfall: unit(p[at + 2]),
    dust: unit(p[at + 3]),
    cloudWater: unit(c[at]) * CLOUD_WATER_CAP,
    towering: unit(c[at + 1]),
    layered: unit(c[at + 2]),
    high: unit(c[at + 3]),
    vapour: unit(v[cell]),
    temperature: unit(f[at]) * TEMPERATURE_TEXTURE_SPAN_CELSIUS + TEMPERATURE_TEXTURE_FLOOR_CELSIUS,
    pressure: (unit(f[at + 1]) * 2 - 1) * PRESSURE_TEXTURE_RANGE,
    windEast,
    windSouth,
    windSpeed: Math.hypot(windEast, windSouth),
    snowCover: unit(g[at]),
    wetness: unit(g[at + 1]),
    gale: unit(g[at + 2]),
    thunder: unit(g[at + 3]),
  };
}

export function describeWeather(weather: CellWeather): string {
  if (weather.thunder > 0.3) return 'thunderstorm';
  if (weather.dust > 0.3) return 'sandstorm';
  if (weather.snowfall > 0.25) return weather.gale > 0.5 ? 'blizzard' : 'snow';
  if (weather.rain > 0.55) return 'heavy rain';
  if (weather.rain > 0.2) return 'rain';
  if (weather.gale > 0.6) return 'storm winds';
  if (weather.overcast > 0.35) return 'overcast';
  if (weather.snowCover > 0.5) return 'snow on the ground';
  return 'clear';
}

export function cloudKind(weather: CellWeather): string {
  if (weather.towering > 0.4) return 'cumulonimbus';
  if (weather.layered > 0.4) return 'stratus';
  if (weather.cloudWater > 0.2) return 'cumulus';
  if (weather.high > 0.45) return 'cirrus';
  return 'clear sky';
}

export class SkyMirror implements SkyView {
  readonly textures: SkyBytes;
  pressureCentres: PressureCentre[] = [];
  readonly lightning: { recentBolts: Bolt[]; dischargeCount: number; groundStrikeCount: number; latestGroundStrike: { x: number; y: number } } = {
    recentBolts: [],
    dischargeCount: 0,
    groundStrikeCount: 0,
    latestGroundStrike: { x: 0, y: 0 },
  };

  constructor(
    readonly grid: WeatherGrid,
    private readonly locate: (tileColumn: number, tileRow: number) => number,
    first: SkyFrame,
  ) {
    this.textures = {
      precipitationData: first.precipitationData.slice(),
      cloudData: first.cloudData.slice(),
      fieldData: first.fieldData.slice(),
      groundData: first.groundData.slice(),
      vapourData: first.vapourData.slice(),
      revision: first.revision,
    };
    this.apply(first);
  }

  apply(frame: SkyFrame): void {
    const { textures } = this;
    textures.precipitationData.set(frame.precipitationData);
    textures.cloudData.set(frame.cloudData);
    textures.fieldData.set(frame.fieldData);
    textures.groundData.set(frame.groundData);
    textures.vapourData.set(frame.vapourData);
    textures.revision = frame.revision;
    this.pressureCentres = frame.pressureCentres;
    this.lightning.recentBolts = frame.recentBolts;
    this.lightning.dischargeCount = frame.dischargeCount;
    this.lightning.groundStrikeCount = frame.groundStrikeCount;
    this.lightning.latestGroundStrike = frame.latestGroundStrike;
  }

  cellContainingTile(tileColumn: number, tileRow: number): number {
    return this.locate(tileColumn, tileRow);
  }
}
