import type { PressureCentre } from './pressureCentres.ts';
import type { SkyFrame, SkyView } from './skyView.ts';
import type { World } from '../world.ts';
import { WEATHER_STEP } from '../terrain/weather.ts';
import { Clouds } from './clouds.ts';
import type { ForcedWeather } from './forcedWeather.ts';
import { GroundSurface } from './groundSurface.ts';
import { Lightning } from './lightning.ts';
import { Precipitation } from './precipitation.ts';
import { StormDamage } from './stormDamage.ts';
import { Temperature } from './temperature.ts';
import { WeatherGrid } from './weatherGrid.ts';
import { WeatherTextures } from './weatherTextures.ts';
import { Winds } from './winds.ts';

const SIMULATION_TICK_DAYS = 1 / 240;
const LONGEST_CATCH_UP_STEP_DAYS = 1 / 30;
const SPIN_UP_STEPS = 36;
const SPIN_UP_STEP_DAYS = 1 / 24;
const FIRST_SEASON_PHASE = 0.375;

export class Sky implements SkyView {
  readonly grid: WeatherGrid;
  readonly temperature: Temperature;
  readonly winds: Winds;
  readonly clouds: Clouds;
  readonly precipitation: Precipitation;
  readonly groundSurface: GroundSurface;
  readonly stormDamage: StormDamage;
  readonly lightning: Lightning;
  readonly textures: WeatherTextures;

  private forced: ForcedWeather | null = null;
  private timeOfDay: number;
  private seasonPhase = FIRST_SEASON_PHASE;
  private timeInDays: number;
  private tickIndex = 0;

  constructor(
    private readonly world: World,
    startTimeInDays: number,
  ) {
    const weather = world.field.weather;
    this.grid = new WeatherGrid(weather.columns, weather.rows);
    this.temperature = new Temperature(this.grid, weather);
    this.winds = new Winds(this.grid, world.grid, weather, world.seed);
    this.clouds = new Clouds(this.grid, weather);
    this.precipitation = new Precipitation(this.grid, weather);
    this.groundSurface = new GroundSurface(this.grid);
    this.stormDamage = new StormDamage(world, this.grid);
    this.lightning = new Lightning(world, this.grid, this.stormDamage);
    this.textures = new WeatherTextures(this.grid);

    this.timeInDays = startTimeInDays;
    this.timeOfDay = startTimeInDays - Math.floor(startTimeInDays);

    this.recomputeWeatherState();
    this.clouds.fillInitialVapour(this.temperature.airTemperature);
    for (let step = 0; step < SPIN_UP_STEPS; step += 1) {
      this.recomputeWeatherState();
      this.formClouds(SPIN_UP_STEP_DAYS);
    }
    this.recomputeWeatherState();
    this.publish();
  }

  get pressureCentres(): readonly PressureCentre[] {
    return this.winds.pressureCentres;
  }

  frame(): SkyFrame {
    const { textures, lightning } = this;
    return {
      precipitationData: textures.precipitationData.slice(),
      cloudData: textures.cloudData.slice(),
      fieldData: textures.fieldData.slice(),
      groundData: textures.groundData.slice(),
      vapourData: textures.vapourData.slice(),
      revision: textures.revision,
      pressureCentres: [...this.winds.pressureCentres],
      recentBolts: [...lightning.recentBolts],
      dischargeCount: lightning.dischargeCount,
      groundStrikeCount: lightning.groundStrikeCount,
      latestGroundStrike: { ...lightning.latestGroundStrike },
    };
  }

  get forcedWeather(): ForcedWeather | null {
    return this.forced;
  }

  set forcedWeather(next: ForcedWeather | null) {
    this.forced = next;
    this.recomputeWeatherState();
    this.publish();
  }

  setCalendar(timeOfDay: number, seasonPhase: number): void {
    if (timeOfDay === this.timeOfDay && seasonPhase === this.seasonPhase) return;
    this.timeOfDay = timeOfDay;
    this.seasonPhase = seasonPhase;
    this.recomputeWeatherState();
    this.publish();
  }

  advanceTo(totalTimeInDays: number): void {
    if (totalTimeInDays - this.timeInDays < SIMULATION_TICK_DAYS) return;
    while (totalTimeInDays - this.timeInDays >= SIMULATION_TICK_DAYS) {
      const stepDays = Math.min(totalTimeInDays - this.timeInDays, LONGEST_CATCH_UP_STEP_DAYS);
      this.timeInDays += stepDays;
      this.recomputeWeatherState();
      this.formClouds(stepDays);
      this.settleGroundAndStorms(stepDays);
    }
    this.publish();
  }

  cellContainingTile(tileColumn: number, tileRow: number): number {
    const column = Math.floor(tileColumn / WEATHER_STEP);
    const row = Math.floor(tileRow / WEATHER_STEP);
    return this.grid.clampedCellIndex(column, row);
  }

  describeWeatherAt(worldX: number, worldY: number): string {
    const { grid } = this.world;
    const cell = this.cellContainingTile(grid.column(worldX), grid.row(worldY));
    const { precipitation, winds, clouds, groundSurface } = this;

    if (precipitation.thunder[cell]! > 0.3) return 'thunderstorm';
    if (precipitation.dust[cell]! > 0.3) return 'sandstorm';
    if (precipitation.snowfall[cell]! > 0.25) return winds.galeStrength[cell]! > 0.5 ? 'blizzard' : 'snow';
    if (precipitation.rain[cell]! > 0.55) return 'heavy rain';
    if (precipitation.rain[cell]! > 0.2) return 'rain';
    if (winds.galeStrength[cell]! > 0.6) return 'storm winds';
    if (clouds.overcast[cell]! > 0.35) return 'overcast';
    if (groundSurface.snowCover[cell]! > 0.5) return 'snow on the ground';
    return 'clear';
  }

  private recomputeWeatherState(): void {
    const { winds, temperature, clouds, precipitation } = this;
    winds.update(this.timeInDays, this.seasonPhase);
    temperature.computeAirTemperature(this.timeOfDay, this.seasonPhase);
    clouds.computeLift(winds, temperature.airTemperature);
    clouds.computeOvercast(this.forced);
    temperature.applyForcedWeather(this.forced);
    clouds.classifyCloudKinds(temperature.forcedTemperature, winds);
    temperature.coolUnderOvercast(clouds.overcast);
    precipitation.compute(this.forced, clouds.overcast, clouds.towering, temperature.surfaceTemperature, winds);
    winds.deriveGale(precipitation.thunder, precipitation.dust);
  }

  private formClouds(elapsedDays: number): void {
    this.clouds.form(
      elapsedDays,
      this.forced,
      this.temperature.airTemperature,
      this.winds,
      this.groundSurface.wetness,
    );
  }

  private settleGroundAndStorms(elapsedDays: number): void {
    this.tickIndex += 1;
    const { groundSurface, precipitation, temperature, stormDamage, winds, lightning } = this;
    groundSurface.integrate(
      elapsedDays,
      this.grid.cellCount,
      precipitation.rain,
      precipitation.snowfall,
      temperature.surfaceTemperature,
    );
    stormDamage.fellTreesInStorms(
      this.tickIndex,
      elapsedDays,
      winds.galeStrength,
      precipitation.thunder,
      precipitation.snowfall,
      groundSurface.snowCover,
      groundSurface.wetness,
    );
    lightning.gatherAndRelease(this.tickIndex, elapsedDays, precipitation.thunder, temperature.surfaceTemperature, winds);
  }

  private publish(): void {
    this.textures.publish(this.clouds, this.precipitation, this.temperature, this.winds, this.groundSurface);
  }
}
