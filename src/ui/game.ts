import type { StructureView } from '../sim/people/structures.ts';
import { structureAt } from '../sim/people/structures.ts';
import type { Camera, Viewport } from '../render/camera.ts';
import { clampCamera, fitWorld, viewZoom, zoomAbout } from '../render/camera.ts';
import type { FogView } from '../render/lit/litLayer.ts';
import type { Lighting, PointLight } from '../render/lit/lighting.ts';
import { flickered, MAX_POINTS, skyAt } from '../render/lit/lighting.ts';
import { placeOf } from '../sim/daylight.ts';
import type { CalendarMoment } from '../sim/calendar.ts';
import type { Calendar, CalendarState } from '../sim/calendar.ts';
import { moonPhaseName } from '../sim/calendar.ts';
import { dateName, sunAndMoonBearingsAt, seasonPhaseAtLatitude, seasonName, localSolarTimeOfDay, southernSeasonPhaseOf } from '../sim/astro.ts';
import { SCALE } from '../render/screen.ts';
import { seasonalStateForBothHemispheres } from '../sim/seasons/seasonalRegistry.ts';
import { CLOUD_WATER_CAP } from '../sim/weather/clouds.ts';
import { FORCED_WEATHER_CHOICES } from '../sim/weather/forcedWeather.ts';
import type { SkyView } from '../sim/weather/skyView.ts';
import { cloudKind, describeWeather, readCell } from '../sim/weather/skyView.ts';
import { PEAK_METRES } from '../sim/terrain/climate.ts';
import { SEA_LEVEL } from '../sim/terrain/heightmap.ts';
import type { Detail } from '../render/terrainPixels.ts';
import { detailFor } from '../render/worldLayer.ts';
import type { Vec2 } from '../sim/geometry.ts';
import type { TileIndex } from '../sim/grid.ts';
import { NOWHERE, TILE } from '../sim/grid.ts';
import type { Tile } from '../sim/tile.ts';
import { windName } from '../sim/terrain/wind.ts';
import { ITEM_NAMES } from '../sim/people/items.ts';
import { ItemType } from '../sim/people/items.ts';
import type { FaunaMirror } from '../sim/fauna/pack.ts';
import type { Shoals } from '../sim/fish/shoals.ts';
import type { People } from '../sim/people/people.ts';
import { NOBODY } from '../sim/people/people.ts';
import type { Thought } from '../sim/people/thoughts.ts';
import { isCritical } from '../sim/people/thoughts.ts';
import type { PersonView } from './personView.ts';
import { personView } from './personView.ts';
import type { Achievement } from '../sim/achievements.ts';
import { ACHIEVEMENTS } from '../sim/achievements.ts';
import type { GameMode, TileCommand } from '../sim/simulation.ts';
import type { Link } from './link.ts';
import type { Replica } from '../sim/link/replica.ts';
import type { World } from '../sim/world.ts';
import { emittersIn } from '../sim/sources/emitters.ts';
import { reachScale } from '../sim/sources/fuel.ts';
import { Trial } from '../sim/discovery/trial.ts';
import { newSlot, readSave, writeSave } from './persist.ts';
import { connect } from './link.ts';
import { connected, launched } from './launch.ts';

export type Tool = 'clear' | 'tread' | 'bolt' | 'uproot';

export const TOOLS: readonly Tool[] = ['clear', 'tread', 'bolt', 'uproot'];

const FOG_CLEAR_TILES = 7;

const FOG_EDGE_TILES = 6;

const LOCKED_MIN_ZOOM = 30 * SCALE;

const FOG_LIFT_SECONDS = 5;

const FOG_OPENED_TILES = 26;

const FOG_OPENED_EDGE_TILES = 12;

const FREE_MIN_ZOOM = 13 * SCALE;

const FIRE_PADDING_PIXELS = 50;

const TOAST_SECONDS = 12;

const PERSON_REACH_TILES = 0.9;

export interface AchievementView {
  id: string;
  title: string;
  reason: string;
  unlocks: readonly string[];
}

const WIND = 1;

const DRIFT = 1.2;

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
  tool: Tool | null;
  day: boolean;
  dayFraction: number;
  announcement: AchievementView | null;
  person: PersonView | null;
  structure: StructureView | null;
  speed: number;
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
  trial: boolean;
}

const OPEN_ZOOM = 48;

type Listener = () => void;

const SAVE_SECONDS = 5;

interface DebugView {
  seed: number;
  mode: GameMode;
  x: number;
  y: number;
  zoom: number;
  forced: number;
  calendar: CalendarState;
}

function parseView(view: DebugView): DebugView {
  const numbers = [view.seed, view.x, view.y, view.zoom, view.forced, view.calendar?.timeOfDay, view.calendar?.elapsedDays];
  if (!numbers.every((value) => typeof value === 'number' && Number.isFinite(value)) || (view.mode !== 'settle' && view.mode !== 'discover')) {
    throw new Error('not a view copied by the target button');
  }
  return view;
}

export class Game {
  link: Link;
  mode: GameMode;
  slot: string;

  camera: Camera = { centre: { x: 0, y: 0 }, zoom: 1 };
  tool: Tool | null = null;

  panel = false;
  viewMode = 0;

  selectedPerson: number = NOBODY;
  selectedStructure: TileIndex = NOWHERE;

  trial: Trial | null = null;
  private trialPerson: number = NOBODY;

  private fogLift = 0;
  private toast: Achievement | null = null;
  private toastLeft = 0;
  private waiting: Achievement[] = [];

  private skyline = '';

  hoveredIndex: TileIndex = NOWHERE;
  openedIndex: TileIndex = NOWHERE;

  private viewport: Viewport | null = null;
  private listeners = new Set<Listener>();
  private snapshot: HudSnapshot;
  private unbind: () => void = () => undefined;

  constructor(slot: string, link: Link) {
    this.slot = slot;
    this.link = link;
    const saved = readSave(slot);
    this.mode = link.replica.mode;
    this.bind();
    if (saved) {
      if (this.mode === 'settle' && this.free) this.fogLift = 1;
      this.restoredCamera = { centre: { x: saved.camera.x, y: saved.camera.y }, zoom: saved.camera.zoom };
    }
    this.snapshot = this.buildSnapshot();
  }

  get replica(): Replica {
    return this.link.replica;
  }

  get world(): World {
    return this.replica.world;
  }

  get sky(): SkyView {
    return this.replica.sky;
  }

  get shoals(): Shoals {
    return this.replica.shoals;
  }

  get fauna(): FaunaMirror | null {
    return this.replica.fauna;
  }

  get people(): People {
    return this.replica.people;
  }

  get calendar(): Calendar {
    return this.replica.calendar;
  }

  get speed(): number {
    return this.replica.speed;
  }

  get playTime(): number {
    return this.replica.playTimeAt(performance.now());
  }

  private bind(): void {
    this.unbind();
    this.unbind = this.link.subscribe((message) => {
      if (message.kind === 'frame') {
        if (message.frame.changed) this.publish();
        return;
      }
      const { event } = message;
      if (event.kind === 'achievement') {
        const achievement = ACHIEVEMENTS.find((candidate) => candidate.id === event.id);
        if (achievement) this.announce(achievement);
      } else this.openTrial(event.person, event.tile, event.items, event.seed);
    });
  }

  private reset(): void {
    this.fogLift = 0;
    this.selectedPerson = NOBODY;
    this.toast = null;
    this.waiting = [];
    this.trial = null;
    this.trialPerson = NOBODY;
  }

  fit(viewport: Viewport): void {
    this.viewport = viewport;
    this.open();
    this.publish();
  }

  private open(): void {
    const viewport = this.viewport;
    if (!viewport) return;

    const first =
      this.restoredCamera ??
      (this.mode === 'discover'
        ? fitWorld(viewport)
        : {
            centre: this.replica.spot,
            zoom: this.free ? OPEN_ZOOM : Math.max(OPEN_ZOOM, LOCKED_MIN_ZOOM),
          });
    this.restoredCamera = null;
    this.camera = this.held(first, viewport);
  }

  private held(camera: Camera, viewport: Viewport): Camera {
    const floor = this.zoomFloor;
    const bounded = clampCamera({ centre: camera.centre, zoom: Math.max(camera.zoom, floor) }, viewport);
    const fire = this.nearestFire(bounded.centre);
    if (!this.free || !fire) return bounded;

    const reachX = Math.max(0, viewport.width / 2 - FIRE_PADDING_PIXELS) / bounded.zoom;
    const reachY = Math.max(0, viewport.height / 2 - FIRE_PADDING_PIXELS) / bounded.zoom;
    return {
      zoom: bounded.zoom,
      centre: {
        x: Math.min(fire.x + reachX, Math.max(fire.x - reachX, bounded.centre.x)),
        y: Math.min(fire.y + reachY, Math.max(fire.y - reachY, bounded.centre.y)),
      },
    };
  }

  private get zoomFloor(): number {
    if (this.mode === 'discover') return 0;
    return this.free ? FREE_MIN_ZOOM : LOCKED_MIN_ZOOM;
  }

  private nearestFire(from: Vec2): Vec2 | null {
    const { grid, fires, embers } = this.world;
    let found: Vec2 | null = null;
    let least = Infinity;
    for (const tile of [...fires, ...embers]) {
      const at = grid.centre(tile);
      const away = Math.hypot(at.x - from.x, at.y - from.y);
      if (away < least) {
        least = away;
        found = at;
      }
    }
    return found;
  }

  async newWorld(seed: number): Promise<void> {
    this.save();
    const carry = this.link.carry();
    this.link.close();
    this.link = await connect({ seed, mode: this.mode, saved: null, carry });
    this.bind();
    this.slot = newSlot();
    this.shot = null;
    this.reset();
    this.hoveredIndex = NOWHERE;
    this.openedIndex = NOWHERE;
    this.tool = null;
    this.open();
    this.publish();
  }

  leave(): void {
    this.save();
    window.location.reload();
  }

  private unsaved = 0;

  private restoredCamera: Camera | null = null;

  saveDue = false;

  shot: string | null = null;

  persist(seconds: number): void {
    this.unsaved += seconds;
    if (this.unsaved >= SAVE_SECONDS) this.saveDue = true;
  }

  save(): void {
    this.unsaved = 0;
    this.saveDue = false;
    const state = this.link.latest;
    if (!state) return;
    writeSave({
      slot: this.slot,
      seed: this.world.seed,
      mode: this.mode,
      savedAt: Date.now(),
      camera: { x: this.camera.centre.x, y: this.camera.centre.y, zoom: this.camera.zoom },
      ...state,
    }, this.shot);
  }

  private openTrial(person: number, tile: TileIndex, items: readonly ItemType[], seed: number): void {
    if (this.trial) return;
    this.trial = new Trial(tile, items, seed);
    this.trialPerson = person;
    this.publish();
  }

  leaveTrial(): void {
    const trial = this.trial;
    if (!trial) return;
    const person = this.trialPerson;
    this.trial = null;
    this.trialPerson = NOBODY;
    this.link.send({ kind: 'commitTrial', person, outcome: trial.outcome() });
  }

  advanceTrial(seconds: number): void {
    this.trial?.update(seconds);
  }

  personAt(point: Vec2): number {
    let found = NOBODY;
    let least = PERSON_REACH_TILES;
    for (let person = 0; person < this.people.count; person += 1) {
      const away = Math.hypot(this.people.posX[person]! - point.x, this.people.posY[person]! - point.y);
      if (away < least) {
        least = away;
        found = person;
      }
    }
    return found;
  }

  selectPerson(person: number): void {
    if (person === this.selectedPerson && (person !== NOBODY || this.selectedStructure === NOWHERE)) return;
    this.selectedPerson = person;
    if (person !== NOBODY) this.selectedStructure = NOWHERE;
    this.publish();
  }

  selectAt(point: Vec2): void {
    const person = this.personAt(point);
    if (person !== NOBODY) {
      this.selectPerson(person);
      return;
    }
    const index = this.tileUnder(point);
    this.selectedStructure = this.world.hasStructure(index) ? index : NOWHERE;
    this.selectedPerson = NOBODY;
    this.publish();
  }

  clearStructureSelection(): void {
    if (this.selectedStructure === NOWHERE) return;
    this.selectedStructure = NOWHERE;
    this.publish();
  }

  get free(): boolean {
    return this.replica.free;
  }

  private announce(achievement: Achievement): void {
    this.waiting.push(achievement);
    if (!this.toast) this.nextToast();
    this.publish();
  }

  private nextToast(): void {
    this.toast = this.waiting.shift() ?? null;
    this.toastLeft = TOAST_SECONDS;
  }

  dismissToast(): void {
    if (!this.toast) return;
    this.nextToast();
    this.publish();
  }

  advanceShell(seconds: number): void {
    if (this.free && this.fogLift < 1) this.fogLift = Math.min(1, this.fogLift + seconds / FOG_LIFT_SECONDS);
    if (!this.toast) return;
    this.toastLeft -= seconds;
    if (this.toastLeft <= 0) this.dismissToast();
  }

  fogView(): FogView | null {
    if (this.mode === 'discover') return null;
    if (!this.free && this.fogLift <= 0) return { x: this.replica.spot.x, y: this.replica.spot.y, inner: FOG_CLEAR_TILES, edge: FOG_EDGE_TILES };
    const eased = this.fogLift * this.fogLift;
    return {
      x: this.replica.spot.x,
      y: this.replica.spot.y,
      inner: FOG_CLEAR_TILES + eased * (FOG_OPENED_TILES - FOG_CLEAR_TILES),
      edge: FOG_EDGE_TILES + eased * (FOG_OPENED_EDGE_TILES - FOG_EDGE_TILES),
    };
  }

  get zoom(): number {
    return viewZoom(this.camera);
  }

  get view(): Camera {
    return { centre: this.camera.centre, zoom: this.zoom };
  }

  pan(dx: number, dy: number, viewport: Viewport): void {
    if (!this.free) return;
    this.camera = this.held(
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
    this.camera = this.free
      ? this.held(zoomAbout(this.camera, screen, viewport, Math.max(factor, this.zoomFloor / this.camera.zoom)), viewport)
      : this.held({ centre: this.camera.centre, zoom: this.camera.zoom * factor }, viewport);
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

  debugView(): string {
    const { centre } = this.camera;
    const place = placeOf(this.world.grid, this.world.seed, centre);
    return JSON.stringify({
      seed: this.world.seed,
      mode: this.mode,
      x: Number(centre.x.toFixed(3)),
      y: Number(centre.y.toFixed(3)),
      zoom: Number(this.zoom.toFixed(3)),
      calendar: this.replica.calendar.state(),
      forced: this.replica.forced,
      localTime: this.localLabel(),
      latitude: Number(place.latitude.toFixed(2)),
    });
  }

  async loadView(text: string): Promise<void> {
    const view = JSON.parse(text) as DebugView;
    parseView(view);
    this.save();
    const carry = { calendar: view.calendar, speed: 0, playTime: 0 };
    this.link.close();
    this.link = await connect({ seed: view.seed, mode: view.mode, saved: null, carry });
    this.mode = this.link.replica.mode;
    this.bind();
    this.slot = newSlot();
    this.shot = null;
    this.reset();
    this.hoveredIndex = NOWHERE;
    this.openedIndex = NOWHERE;
    this.tool = null;
    this.restoredCamera = { centre: { x: view.x, y: view.y }, zoom: view.zoom };
    this.link.send({ kind: 'setForced', index: view.forced });
    this.open();
    this.publish();
  }

  skip(hours: number): void {
    this.link.send({ kind: 'skip', hours });
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
      points: flickered(this.lightSources(), seconds),
    };
  }

  private lightSources(): PointLight[] {
    const { centre } = this.camera;
    const lit: PointLight[] = [];
    for (const { id, kind, x, y, level } of emittersIn(this.world, this.people)) {
      const { light } = kind;
      if (!light) continue;
      lit.push({ id, x, y, reach: light.reach * reachScale(level), strength: light.strength * level, color: light.colour, ...(kind.look === 'post' ? {} : { source: kind.look }) });
    }
    if (lit.length <= MAX_POINTS) return lit;
    const away = (light: PointLight): number => Math.hypot(light.x - centre.x, light.y - centre.y);
    return lit.sort((a, b) => away(a) - away(b)).slice(0, MAX_POINTS);
  }

  advance(seconds: number): void {
    this.replica.interpolate(performance.now());
    if (this.selectedStructure !== NOWHERE && !this.world.hasStructure(this.selectedStructure)) this.clearStructureSelection();
    this.advanceShell(seconds);
    this.persist(seconds);
    this.advanceTrial(seconds);
    this.refreshSkyline();
  }

  thoughtsOf(person: number): readonly Thought[] {
    return this.replica.thoughtsOf(person);
  }

  isAlarmed(person: number): boolean {
    return isCritical(this.thoughtsOf(person));
  }

  private command(kind: TileCommand, tile: TileIndex): void {
    this.link.send({ kind, tile });
  }

  lightTorch(index: TileIndex): void {
    this.command('lightTorch', index);
  }

  planCampfire(index: TileIndex): void {
    this.command('planCampfire', index);
  }

  planRelight(index: TileIndex): void {
    this.command('planRelight', index);
  }

  addFuel(index: TileIndex): void {
    this.command('addFuel', index);
  }

  cancelPlan(index: TileIndex): void {
    this.command('cancelPlan', index);
  }

  plantTorch(index: TileIndex): void {
    this.command('plantTorch', index);
  }

  layFloor(index: TileIndex): void {
    this.command('layFloor', index);
  }

  clearFloor(index: TileIndex): void {
    this.command('clearFloor', index);
  }

  designateStorage(index: TileIndex): void {
    this.command('designateStorage', index);
  }

  clearStorage(index: TileIndex): void {
    this.command('clearStorage', index);
  }

  pickUp(index: TileIndex, item: ItemType): void {
    this.link.send({ kind: 'pickUp', tile: index, item });
  }

  bringHere(index: TileIndex): void {
    this.command('bringHere', index);
  }

  experiment(index: TileIndex): void {
    this.command('experiment', index);
  }

  chopWood(index: TileIndex): void {
    this.command('chopWood', index);
  }

  private groundItems(tile: Tile): string | null {
    const { items } = this.world;
    const kinds = items.kindsAt(tile.index);
    if (kinds.length === 0) return null;
    return kinds.map((kind) => `${items.tally(tile.index, kind)} ${ITEM_NAMES[kind]}`).join(', ');
  }

  setForced(index: number): void {
    this.link.send({ kind: 'setForced', index });
  }

  setSpeed(speed: number): void {
    this.link.send({ kind: 'setSpeed', speed });
  }

  togglePause(): void {
    this.link.send({ kind: 'togglePause' });
  }

  cycleSpeed(): void {
    this.link.send({ kind: 'cycleSpeed' });
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
    this.link.send({ kind: 'setMinutes', minutes });
  }

  setSeason(phase: number): void {
    this.link.send({ kind: 'setSeason', phase });
  }

  setMoon(phase: number): void {
    this.link.send({ kind: 'setMoon', phase });
  }

  get shownMinutes(): number {
    return Math.floor((this.clock * 1440) / 10) * 10;
  }

  seasonHere(): string {
    const { world } = this;
    return seasonName(seasonPhaseAtLatitude(this.season, placeOf(world.grid, world.seed, this.camera.centre).latitude));
  }

  localDay(): number {
    const { world } = this;
    return localSolarTimeOfDay(this.clock, placeOf(world.grid, world.seed, this.camera.centre).offset);
  }

  localLabel(): string {
    const local = this.localDay();
    const total = Math.floor((local * 1440) / 10) * 10;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  clockLabel(): string {
    const total = this.shownMinutes;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  weatherHere(): string {
    const forced = FORCED_WEATHER_CHOICES[this.replica.forced];
    const here = this.describeWeatherAt(this.camera.centre);
    return forced ? `${here} (${forced})` : here;
  }

  private cellAt(point: Vec2): number {
    const { grid } = this.world;
    return this.sky.cellContainingTile(grid.column(point.x), grid.row(point.y));
  }

  private describeWeatherAt(point: Vec2): string {
    return describeWeather(readCell(this.sky, this.cellAt(point)));
  }

  private refreshSkyline(): void {
    const label = `${this.localLabel()}, ${dateName(this.season)}, ${this.seasonHere()}, ${moonPhaseName(this.moon)}, ${this.weatherHere()}`;
    if (label === this.skyline) return;
    this.skyline = label;
    this.publish();
  }

  setTool(tool: Tool | null): void {
    this.tool = tool;
    this.publish();
  }

  openTile(index: TileIndex): void {
    this.openedIndex = index;
    this.publish();
  }

  use(index: TileIndex): void {
    if (index === NOWHERE || this.tool === null) return;

    this.link.send({ kind: 'use', tool: this.tool, tile: index });
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
    const air = readCell(sky, cell);
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
    const front = air.overcast;
    const level =
      brightness(lights.sun) * (1 - 0.75 * front) + brightness(lights.moon) + brightness(lights.ambient) * (1 - 0.3 * front);

    const speed = air.windSpeed;
    const humidity = weather.humid[cell]! * 0.7 + air.wetness * 0.2 + air.rain * 0.3;
    const here = describeWeather(air);
    const forced = FORCED_WEATHER_CHOICES[this.replica.forced];

    const lying = this.groundItems(tile);

    return [
      ...(lying ? ([['on the ground', lying]] as const) : []),
      ['height', `${Math.round(metres)} m`],
      ['temperature', `${air.temperature.toFixed(1)} C`],
      ['weather', forced ? `${here} (${forced})` : here],
      ['cloud', cloudKind(air)],
      ['cloud water', percent(air.cloudWater / CLOUD_WATER_CAP)],
      ['vapour', percent(air.vapour)],
      ['storm front', percent(front)],
      ['wind', `${speed.toFixed(1)} m/s, ${windName(tile.wind)}`],
      ['pressure', `${Math.round(1013 + air.pressure * 9)} hPa`],
      ['humidity', percent(humidity)],
      ['rain', percent(air.rain)],
      ['snowfall', percent(air.snowfall)],
      ['dust', percent(air.dust)],
      ['snow cover', percent(air.snowCover)],
      ['wet ground', percent(air.wetness)],
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
      dayFraction: this.localDay(),
      structure: this.selectedStructure === NOWHERE ? null : structureAt(this.world, this.people, this.selectedStructure),
      person: this.selectedPerson === NOBODY ? null : personView(this.people, this.selectedPerson, this.thoughtsOf(this.selectedPerson)),
      announcement: this.toast
        ? { id: this.toast.id, title: this.toast.title, reason: this.toast.reason, unlocks: this.toast.unlocks }
        : null,
      speed: this.speed,
      sky: `${this.localLabel()} here, ${this.seasonHere()}, ${moonPhaseName(this.moon)}`,
      weather: this.weatherHere(),
      minutes: this.shownMinutes,
      season: this.season,
      moon: this.moon,
      forced: this.replica.forced,
      trial: this.trial !== null,
      panel: this.panel,
      view: this.viewMode,
      hovered: hovered ? this.viewOf(hovered) : null,
      opened: opened ? this.viewOf(opened) : null,
      tiles: this.world.count,
    };
  }
}

const launch = launched();

export const game = new Game(launch.slot, await connected());
