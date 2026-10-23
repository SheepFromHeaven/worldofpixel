import type { Camera, Viewport } from '../render/camera.ts';
import { clampCamera, fitWorld, viewZoom, zoomAbout } from '../render/camera.ts';
import type { Lighting, PointLight } from '../render/lit/lighting.ts';
import { flickered, MAX_POINTS, skyAt } from '../render/lit/lighting.ts';
import type { CalendarMoment } from '../sim/calendar.ts';
import { Calendar, moonPhaseName } from '../sim/calendar.ts';
import { dateName, sunAndMoonBearingsAt, seasonPhaseAtLatitude, seasonName, localSolarTimeOfDay, southernSeasonPhaseOf } from '../sim/astro.ts';
import { placeOf } from '../render/lit/skyGrid.ts';
import { SCALE } from '../render/screen.ts';
import { seasonalStateForBothHemispheres } from '../sim/seasons/seasonalRegistry.ts';
import { CLOUD_WATER_CAP } from '../sim/weather/clouds.ts';
import { FORCED_WEATHER_CHOICES } from '../sim/weather/forcedWeather.ts';
import { Sky } from '../sim/weather/sky.ts';
import { PEAK_METRES } from '../sim/terrain/climate.ts';
import { SEA_LEVEL } from '../sim/terrain/heightmap.ts';
import type { Detail } from '../render/terrainPixels.ts';
import { detailFor } from '../render/worldLayer.ts';
import type { Vec2 } from '../sim/geometry.ts';
import type { TileIndex } from '../sim/grid.ts';
import { NOWHERE, TILE } from '../sim/grid.ts';
import type { Tile } from '../sim/tile.ts';
import { windName } from '../sim/terrain/wind.ts';
import { WORLD_EXTENT } from '../sim/terrain/terrain.ts';
import { World } from '../sim/world.ts';
import { rememberSeed, startingSeed } from './seed.ts';

export type Tool = 'look' | 'clear' | 'tread' | 'torch' | 'bolt' | 'uproot';

export const TOOLS: readonly Tool[] = ['look', 'clear', 'tread', 'torch', 'bolt', 'uproot'];

const DAY_SECONDS = 1440;

const WIND = 1;

const DRIFT = 1.2;

const TORCH: Omit<PointLight, 'id' | 'x' | 'y'> = { reach: 4.5, strength: 1.1, color: [1, 0.62, 0.3] };

export interface TileView {
  index: TileIndex;
  column: number;
  row: number;
  centre: Vec2;
  biome: string;
  standing: string;
  elevation: number;
  wear: number;
  readout: readonly (readonly [string, string])[];
  walkable: boolean;
  refusal: string | null;
}

export interface HudSnapshot {
  seed: number;
  zoom: number;
  detail: Detail;
  tool: Tool;
  day: boolean;
  speed: number;
  clockMenu: boolean;
  sky: string;
  weather: string;
  minutes: number;
  season: number;
  moon: number;
  forced: number;
  panel: boolean;
  view: number;
  hovered: TileView | null;
  opened: TileView | null;
  tiles: number;
}

const OPEN_ZOOM = 48;

const OPEN_STRIDE = 7;

function openingSpot(world: World): Vec2 {
  const { grid } = world;
  const middle = { column: grid.column(WORLD_EXTENT.width / 2), row: grid.row(WORLD_EXTENT.height / 2) };
  const rings = Math.ceil(Math.max(grid.columns, grid.rows) / (2 * OPEN_STRIDE));

  for (let ring = 0; ring <= rings; ring += 1) {
    for (let dr = -ring; dr <= ring; dr += 1) {
      for (let dc = -ring; dc <= ring; dc += 1) {
        if (ring > 0 && Math.abs(dr) !== ring && Math.abs(dc) !== ring) continue;
        const index = grid.at(middle.column + dc * OPEN_STRIDE, middle.row + dr * OPEN_STRIDE);
        if (world.walkable(index)) return grid.centre(index);
      }
    }
  }

  return { x: WORLD_EXTENT.width / 2, y: WORLD_EXTENT.height / 2 };
}

type Listener = () => void;

function cloudKind(sky: Sky, cell: number): string {
  if (sky.clouds.towering[cell]! > 0.4) return 'cumulonimbus';
  if (sky.clouds.layered[cell]! > 0.4) return 'stratus';
  if (sky.clouds.cloudWater[cell]! > 0.2) return 'cumulus';
  if (sky.clouds.high[cell]! > 0.45) return 'cirrus';
  return 'clear sky';
}

export class Game {
  world: World;

  camera: Camera = { centre: { x: 0, y: 0 }, zoom: 1 };
  tool: Tool = 'look';

  readonly calendar = new Calendar();
  speed = 0;
  playTime = 0;
  clockMenu = false;
  panel = false;
  viewMode = 0;
  torches: PointLight[] = [];

  sky: Sky;

  private lit = 0;
  private skyline = '';
  private dial = 0;

  hoveredIndex: TileIndex = NOWHERE;
  openedIndex: TileIndex = NOWHERE;

  private viewport: Viewport | null = null;
  private listeners = new Set<Listener>();
  private snapshot: HudSnapshot;

  constructor(seed: number) {
    this.world = World.generate(seed);
    this.sky = new Sky(this.world, this.calendar.elapsedDays);
    this.snapshot = this.buildSnapshot();
  }

  fit(viewport: Viewport): void {
    this.viewport = viewport;
    this.open();
    this.publish();
  }

  private open(): void {
    const viewport = this.viewport;
    if (!viewport) return;

    this.camera = clampCamera({ centre: openingSpot(this.world), zoom: OPEN_ZOOM }, viewport);
  }

  newWorld(seed: number): void {
    this.world = World.generate(seed);
    this.sky = new Sky(this.world, this.calendar.elapsedDays);
    this.dial = 0;
    this.hoveredIndex = NOWHERE;
    this.openedIndex = NOWHERE;
    this.tool = 'look';
    this.torches = [];
    rememberSeed(seed);
    this.open();
    this.publish();
  }

  get zoom(): number {
    return viewZoom(this.camera);
  }

  get view(): Camera {
    return { centre: this.camera.centre, zoom: this.zoom };
  }

  pan(dx: number, dy: number, viewport: Viewport): void {
    this.camera = clampCamera(
      {
        zoom: this.camera.zoom,
        centre: {
          x: this.camera.centre.x - dx / this.zoom,
          y: this.camera.centre.y - dy / this.zoom,
        },
      },
      viewport,
    );
  }

  zoomAt(screen: Vec2, viewport: Viewport, factor: number): void {
    this.camera = zoomAbout(this.camera, screen, viewport, factor);
    this.publish();
  }

  fitWorld(viewport: Viewport): void {
    this.camera = fitWorld(viewport);
    this.publish();
  }

  detail(): Detail {
    return detailFor(this.zoom / SCALE);
  }

  get reaches(): boolean {
    return this.zoom / SCALE >= TILE;
  }

  tileUnder(point: Vec2): TileIndex {
    const { grid } = this.world;
    const column = Math.floor((point.x - grid.minX) / grid.spacing);
    const row = Math.floor((point.y - grid.minY) / grid.spacing);
    return grid.at(column, row);
  }

  tile(index: TileIndex): Tile | null {
    return index === NOWHERE ? null : this.world.tile(index);
  }

  get clock(): number {
    return this.calendar.timeOfDay;
  }

  get elapsed(): number {
    return this.calendar.elapsedDays;
  }

  get moon(): number {
    return this.calendar.moonPhase;
  }

  get season(): number {
    return this.calendar.seasonPhase;
  }

  get moment(): CalendarMoment {
    return this.calendar.moment;
  }

  private seasons(): Pick<Lighting, 'seasonalShaderTable' | 'fallingLeaves' | 'blowingPetals' | 'leafLitter'> {
    const state = seasonalStateForBothHemispheres(this.season, southernSeasonPhaseOf(this.season));
    return {
      seasonalShaderTable: state.shaderTable,
      fallingLeaves: state.fallingLeaves,
      blowingPetals: state.blowingPetals,
      leafLitter: state.leafLitter,
    };
  }

  lightingAt(seconds: number): Lighting {
    return {
      ...skyAt(this.moment, placeOf(this.world.grid, this.world.seed, this.camera.centre)),
      moment: this.moment,
      ...this.seasons(),
      drift: [this.world.field.prevailing * DRIFT, DRIFT * 0.25],
      wind: WIND,
      points: flickered(this.torches, seconds),
    };
  }

  private syncSky(): void {
    this.sky.setCalendar(this.clock, this.season);
    this.sky.advanceTo(this.elapsed);
  }

  advanceLight(seconds: number): void {
    if (this.speed > 0) {
      this.playTime += seconds * this.speed;
      this.calendar.advanceByDays((seconds * this.speed) / DAY_SECONDS);
    }
    this.syncSky();
    if (this.speed > 0) this.refreshSkyline();
  }

  setForced(index: number): void {
    this.dial = index;
    this.sky.forcedWeather = FORCED_WEATHER_CHOICES[index] ?? null;
    this.publish();
  }

  toggleClockMenu(): void {
    this.clockMenu = !this.clockMenu;
    this.publish();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.publish();
  }

  setView(mode: number): void {
    this.viewMode = mode;
    this.publish();
  }

  togglePanel(): void {
    this.panel = !this.panel;
    this.publish();
  }

  setMinutes(minutes: number): void {
    this.calendar.setMinuteOfDay(minutes);
    this.syncSky();
    this.publish();
  }

  setSeason(phase: number): void {
    this.calendar.setSeasonPhase(phase);
    this.syncSky();
    this.publish();
  }

  setMoon(phase: number): void {
    this.calendar.setMoonPhase(phase);
    this.publish();
  }

  get shownMinutes(): number {
    return Math.floor((this.clock * 1440) / 10) * 10;
  }

  seasonHere(): string {
    const { world } = this;
    return seasonName(seasonPhaseAtLatitude(this.season, placeOf(world.grid, world.seed, this.camera.centre).latitude));
  }

  localLabel(): string {
    const { world } = this;
    const local = localSolarTimeOfDay(this.clock, placeOf(world.grid, world.seed, this.camera.centre).offset);
    const total = Math.floor((local * 1440) / 10) * 10;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  clockLabel(): string {
    const total = this.shownMinutes;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  weatherHere(): string {
    const forced = FORCED_WEATHER_CHOICES[this.dial];
    const here = this.sky.describeWeatherAt(this.camera.centre.x, this.camera.centre.y);
    return forced ? `${here} (${forced})` : here;
  }

  private refreshSkyline(): void {
    const label = `${this.localLabel()}, ${dateName(this.season)}, ${this.seasonHere()}, ${moonPhaseName(this.moon)}, ${this.weatherHere()}`;
    if (label === this.skyline) return;
    this.skyline = label;
    this.publish();
  }

  private lightTile(index: TileIndex): void {
    const centre = this.world.grid.centre(index);
    const standing = this.torches.findIndex((light) => Math.hypot(light.x - centre.x, light.y - centre.y) < 0.5);
    if (standing >= 0) this.torches.splice(standing, 1);
    else this.torches.push({ ...TORCH, id: (this.lit += 1), x: centre.x, y: centre.y });
    if (this.torches.length > MAX_POINTS) this.torches.shift();
  }

  setTool(tool: Tool): void {
    this.tool = tool;
    this.publish();
  }

  openTile(index: TileIndex): void {
    this.openedIndex = index;
    this.publish();
  }

  use(index: TileIndex): void {
    if (index === NOWHERE) return;

    if (this.tool === 'clear') this.world.clear(index);
    else if (this.tool === 'tread') this.world.tread(index, 48);
    else if (this.tool === 'torch') this.lightTile(index);
    else if (this.tool === 'bolt') this.sky.lightning.strikeGroundAt(index);
    else if (this.tool === 'uproot') this.world.fell(index);
    else this.openTile(index);

    if (this.tool !== 'look') this.publish();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  read(): HudSnapshot {
    return this.snapshot;
  }

  publish(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }

  private readout(tile: Tile): readonly (readonly [string, string])[] {
    const { world, sky } = this;
    const cell = sky.cellContainingTile(tile.column, tile.row);
    const weather = world.field.weather;
    const metres = ((tile.elevation - SEA_LEVEL) / (1 - SEA_LEVEL)) * PEAK_METRES;
    const percent = (value: number): string => `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
    const brightness = (colour: readonly [number, number, number]): number => (colour[0] + colour[1] + colour[2]) / 3;

    const place = placeOf(world.grid, world.seed, tile.centre);
    const lights = skyAt(this.moment, place);
    const heavens = sunAndMoonBearingsAt(place.latitude, localSolarTimeOfDay(this.clock, place.offset), this.season, this.moon);
    const degrees = (up: number): string => `${Math.round((Math.asin(Math.min(1, Math.max(-1, up))) * 180) / Math.PI)} deg`;
    const localMinutes = Math.floor(localSolarTimeOfDay(this.clock, place.offset) * 1440);
    const localTime = `${String(Math.floor(localMinutes / 60)).padStart(2, '0')}:${String(localMinutes % 60).padStart(2, '0')}`;
    const front = sky.clouds.overcast[cell]!;
    const level =
      brightness(lights.sun) * (1 - 0.75 * front) + brightness(lights.moon) + brightness(lights.ambient) * (1 - 0.3 * front);

    const speed = sky.winds.windSpeed[cell]!;
    const humidity = weather.humid[cell]! * 0.7 + sky.groundSurface.wetness[cell]! * 0.2 + sky.precipitation.rain[cell]! * 0.3;
    const here = sky.describeWeatherAt(tile.centre.x, tile.centre.y);
    const forced = FORCED_WEATHER_CHOICES[this.dial];

    return [
      ['height', `${Math.round(metres)} m`],
      ['temperature', `${sky.temperature.surfaceTemperature[cell]!.toFixed(1)} C`],
      ['weather', forced ? `${here} (${forced})` : here],
      ['cloud', cloudKind(sky, cell)],
      ['cloud water', percent(sky.clouds.cloudWater[cell]! / CLOUD_WATER_CAP)],
      ['vapour', percent(sky.clouds.vapour[cell]!)],
      ['storm front', percent(front)],
      ['wind', `${speed.toFixed(1)} m/s, ${windName(tile.wind)}`],
      ['pressure', `${Math.round(1013 + sky.winds.pressure[cell]! * 9)} hPa`],
      ['humidity', percent(humidity)],
      ['rain', percent(sky.precipitation.rain[cell]!)],
      ['snowfall', percent(sky.precipitation.snowfall[cell]!)],
      ['dust', percent(sky.precipitation.dust[cell]!)],
      ['snow cover', percent(sky.groundSurface.snowCover[cell]!)],
      ['wet ground', percent(sky.groundSurface.wetness[cell]!)],
      ['fog chance', percent(weather.data[cell * 4]! / 255)],
      ['light', percent(level / 1.55)],
      ['local time', localTime],
      ['sun', degrees(heavens.sun.up)],
      ['moon', degrees(heavens.moon.up)],
      ['season', seasonName(seasonPhaseAtLatitude(this.season, place.latitude))],
      ['date', dateName(this.season)],
      ['time', this.clockLabel()],
    ];
  }

  private viewOf(tile: Tile): TileView {
    return {
      index: tile.index,
      column: tile.column,
      row: tile.row,
      centre: tile.centre,
      biome: tile.name,
      standing: tile.standing,
      elevation: tile.elevation,
      wear: tile.wear,
      readout: this.readout(tile),
      walkable: tile.walkable,
      refusal: tile.refusal,
    };
  }

  private buildSnapshot(): HudSnapshot {
    const hovered = this.tile(this.hoveredIndex);
    const opened = this.tile(this.openedIndex);

    return {
      seed: this.world.seed,
      zoom: this.zoom,
      detail: this.detail(),
      tool: this.tool,
      day: this.speed > 0,
      speed: this.speed,
      clockMenu: this.clockMenu,
      sky: `${this.localLabel()} here, ${this.seasonHere()}, ${moonPhaseName(this.moon)}`,
      weather: this.weatherHere(),
      minutes: this.shownMinutes,
      season: this.season,
      moon: this.moon,
      forced: this.dial,
      panel: this.panel,
      view: this.viewMode,
      hovered: hovered ? this.viewOf(hovered) : null,
      opened: opened ? this.viewOf(opened) : null,
      tiles: this.world.count,
    };
  }
}

export const game = new Game(startingSeed());
