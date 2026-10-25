import type { StructureView } from '../sim/people/structures.ts';
import { structureAt } from '../sim/people/structures.ts';
import type { Camera, Viewport } from '../render/camera.ts';
import { clampCamera, fitWorld, viewZoom, zoomAbout } from '../render/camera.ts';
import type { FogView } from '../render/lit/litLayer.ts';
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
import { ITEM_NAMES } from '../sim/people/items.ts';
import { ItemType } from '../sim/people/items.ts';
import type { LightSpot, PeopleEnvironment } from '../sim/people/people.ts';
import { NOBODY, People } from '../sim/people/people.ts';
import type { Thought } from '../sim/people/thoughts.ts';
import { isCritical, thoughtsFor } from '../sim/people/thoughts.ts';
import type { PersonView } from './personView.ts';
import { personView } from './personView.ts';
import type { Achievement } from '../sim/achievements.ts';
import { Achievements } from '../sim/achievements.ts';
import { World } from '../sim/world.ts';
import { emittersIn, warmthFrom } from '../sim/sources/emitters.ts';
import { reachScale } from '../sim/sources/fuel.ts';
import { Trial } from '../sim/discovery/trial.ts';
import { newSlot, readSave, writeSave } from './persist.ts';
import type { GameMode } from './launch.ts';
import { launched } from './launch.ts';
import type { SaveData } from './persist.ts';

export type Tool = 'clear' | 'tread' | 'bolt' | 'uproot';

export const TOOLS: readonly Tool[] = ['clear', 'tread', 'bolt', 'uproot'];

const DAY_SECONDS = 1440;

const THOUGHT_SECONDS = 0.5;

const LIGHT_SEEK_TILES = 60;

const SLEEP_BY_FIRE_TILES = 2.2;

const SLEEP_BY_TORCH_TILES = 1.2;

const SPEED_STEPS = 3;

const FOG_CLEAR_TILES = 7;

const FOG_EDGE_TILES = 6;

const CONFINE_TILES = FOG_CLEAR_TILES + 4;

const LOCKED_MIN_ZOOM = 30 * SCALE;

const FOG_LIFT_SECONDS = 5;

const FOG_OPENED_TILES = 26;

const FOG_OPENED_EDGE_TILES = 12;

const CONFINE_OPENED_TILES = FOG_OPENED_TILES - 2;

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

const SAVE_SECONDS = 5;

export class Game {
  world: World;
  mode: GameMode;
  slot: string;

  camera: Camera = { centre: { x: 0, y: 0 }, zoom: 1 };
  tool: Tool | null = null;

  readonly calendar = new Calendar();
  speed = 1;
  playTime = 0;
  private resumeSpeed = 1;
  panel = false;
  viewMode = 0;

  sky: Sky;
  people!: People;
  achievements!: Achievements;

  selectedPerson: number = NOBODY;
  selectedStructure: TileIndex = NOWHERE;
  private thoughts: Thought[][] = [];
  private thoughtClock = 0;

  trial: Trial | null = null;
  private trialPerson: number = NOBODY;
  private speedBeforeTrial = 1;

  private fogCentre: Vec2 = { x: 0, y: 0 };
  private fogLift = 0;
  private toast: Achievement | null = null;
  private toastLeft = 0;
  private waiting: Achievement[] = [];

  private skyline = '';
  private dial = 0;

  hoveredIndex: TileIndex = NOWHERE;
  openedIndex: TileIndex = NOWHERE;

  private viewport: Viewport | null = null;
  private listeners = new Set<Listener>();
  private snapshot: HudSnapshot;

  constructor(slot: string, seed: number, mode: GameMode) {
    this.slot = slot;
    this.world = World.generate(seed);
    const saved = readSave(slot);
    this.mode = saved?.mode ?? mode;
    if (saved) this.calendar.restore(saved.calendar);
    this.sky = new Sky(this.world, this.calendar.elapsedDays);
    this.settle();
    if (saved) this.resume(saved);
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

    const first =
      this.restoredCamera ??
      (this.mode === 'discover'
        ? fitWorld(viewport)
        : {
            centre: openingSpot(this.world),
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

  newWorld(seed: number): void {
    this.save();
    this.world = World.generate(seed);
    this.slot = newSlot();
    this.shot = null;
    this.sky = new Sky(this.world, this.calendar.elapsedDays);
    this.settle();
    this.dial = 0;
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

  private resume(saved: SaveData): void {
    this.world.restore(saved.world);
    this.people.restore(saved.people);
    this.people.endAllTrials();
    this.achievements.restore(saved.achievements);
    this.speed = saved.speed;
    this.playTime = saved.playTime;
    if (this.mode === 'settle' && this.free) {
      this.widen();
      this.fogLift = 1;
    }
    this.restoredCamera = { centre: { x: saved.camera.x, y: saved.camera.y }, zoom: saved.camera.zoom };
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
    writeSave({
      slot: this.slot,
      seed: this.world.seed,
      mode: this.mode,
      savedAt: Date.now(),
      calendar: this.calendar.state(),
      speed: this.trial ? this.speedBeforeTrial : this.speed,
      playTime: this.playTime,
      camera: { x: this.camera.centre.x, y: this.camera.centre.y, zoom: this.camera.zoom },
      achievements: [...this.achievements.ids],
      people: this.people.snapshot(),
      world: this.world.snapshot(),
    }, this.shot);
  }

  private settle(): void {
    const spot = openingSpot(this.world);
    this.people = new People(this.world, this.mode === 'settle' ? spot : null);
    this.thoughts = [];
    this.thoughtClock = 0;
    this.fogCentre = spot;
    this.fogLift = 0;
    this.selectedPerson = NOBODY;
    this.toast = null;
    this.waiting = [];
    if (this.mode === 'settle') this.world.confine(this.world.grid.atPoint(spot), CONFINE_TILES);
    this.achievements = new Achievements();
    this.achievements.subscribe((achievement) => this.announce(achievement));
    this.trial = null;
    this.trialPerson = NOBODY;
    this.people.subscribe((event) => {
      if (event.kind === 'trial') this.openTrial(event.person, event.tile);
    });
  }

  private openTrial(person: number, tile: TileIndex): void {
    if (this.trial) return;
    const { items } = this.world;
    const kinds = items.at(tile).map((slot) => items.kind[slot]! as ItemType);
    this.trial = new Trial(tile, kinds, this.world.seed ^ Math.floor(this.calendar.elapsedDays * 1e4));
    this.trialPerson = person;
    this.speedBeforeTrial = this.speed > 0 ? this.speed : this.resumeSpeed;
    this.speed = 0;
    this.publish();
  }

  leaveTrial(): void {
    const trial = this.trial;
    if (!trial) return;
    trial.commit(this.world, this.people);
    this.people.endTrial(this.trialPerson);
    this.trial = null;
    this.trialPerson = NOBODY;
    this.setSpeed(this.speedBeforeTrial);
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
    return this.mode === 'discover' || this.achievements.has('fire');
  }

  private widen(): void {
    if (this.mode === 'discover') return;
    this.world.confine(this.world.grid.atPoint(this.fogCentre), CONFINE_OPENED_TILES);
  }

  private announce(achievement: Achievement): void {
    this.widen();
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
    if (!this.free && this.fogLift <= 0) return { x: this.fogCentre.x, y: this.fogCentre.y, inner: FOG_CLEAR_TILES, edge: FOG_EDGE_TILES };
    const eased = this.fogLift * this.fogLift;
    return {
      x: this.fogCentre.x,
      y: this.fogCentre.y,
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

  private readonly surroundings: PeopleEnvironment = {
    temperatureAt: (tile) => {
      const { world, sky } = this;
      return sky.temperature.surfaceTemperature[sky.cellContainingTile(world.grid.columnOf(tile), world.grid.rowOf(tile))]!;
    },
    warmthAt: (x, y) => warmthFrom(emittersIn(this.world, this.people), x, y),
    gloomAt: (x, y) => skyAt(this.moment, placeOf(this.world.grid, this.world.seed, { x, y })).gloom,
    lightNear: (x, y) => {
      let found: LightSpot | null = null;
      let least = LIGHT_SEEK_TILES;
      for (const { kind, x: lx, y: ly } of emittersIn(this.world, this.people)) {
        if (!kind.light || kind.look === 'hand') continue;
        const away = Math.hypot(lx - x, ly - y);
        if (away < least) {
          least = away;
          found = { x: lx, y: ly, side: kind.look === 'fire' ? SLEEP_BY_FIRE_TILES : SLEEP_BY_TORCH_TILES };
        }
      }
      return found;
    },
  };

  advancePeople(seconds: number): void {
    this.world.burn(seconds * this.speed);
    this.people.update(seconds * this.speed, this.surroundings);
    this.achievements.check(this.people);
    if (this.selectedStructure !== NOWHERE && !this.world.hasStructure(this.selectedStructure)) this.clearStructureSelection();
    this.thoughtClock -= seconds;
    if (this.thoughtClock <= 0) {
      this.thoughtClock = THOUGHT_SECONDS;
      this.rethink();
    }
  }

  private rethink(): void {
    const { world, sky, people } = this;
    this.thoughts = [];
    for (let person = 0; person < people.count; person += 1) {
      const x = people.posX[person]!;
      const y = people.posY[person]!;
      const cell = sky.cellContainingTile(world.grid.column(x), world.grid.row(y));
      this.thoughts.push(
        thoughtsFor(people, person, {
          rain: sky.precipitation.rain[cell]!,
          snow: sky.precipitation.snowfall[cell]!,
          gloom: skyAt(this.moment, placeOf(world.grid, world.seed, { x, y })).gloom,
        }),
      );
    }
  }

  thoughtsOf(person: number): readonly Thought[] {
    return this.thoughts[person] ?? [];
  }

  isAlarmed(person: number): boolean {
    return isCritical(this.thoughtsOf(person));
  }

  lightTorch(index: TileIndex): void {
    const who = this.people.lighterFor(index);
    if (who !== NOBODY) this.people.sendToLight(who, index);
  }

  planCampfire(index: TileIndex): void {
    if (!this.world.planCampfire(index)) return;
    const who = this.people.builderFor(index);
    if (who !== NOBODY) this.people.sendToBuild(who, index);
  }

  planRelight(index: TileIndex): void {
    if (!this.world.planRelight(index)) return;
    const who = this.people.builderFor(index);
    if (who !== NOBODY) this.people.sendToBuild(who, index);
  }

  addFuel(index: TileIndex): void {
    const who = this.people.feederFor(index);
    if (who !== NOBODY) this.people.sendToFeed(who, index);
  }

  cancelPlan(index: TileIndex): void {
    this.people.abandonPlan(index);
    this.world.unplan(index);
  }

  plantTorch(index: TileIndex): void {
    const who = this.people.planterFor(index);
    if (who !== NOBODY) this.people.sendToPlant(who, index);
  }

  layFloor(index: TileIndex): void {
    this.world.layFloor(index);
    this.publish();
  }

  clearFloor(index: TileIndex): void {
    this.world.unfloor(index);
    this.publish();
  }

  designateStorage(index: TileIndex): void {
    this.world.designate(index);
    this.publish();
  }

  clearStorage(index: TileIndex): void {
    this.world.release(index);
    this.publish();
  }

  pickUp(index: TileIndex, kind: ItemType): void {
    const who = this.people.pickerFor(index);
    if (who !== NOBODY) this.people.sendToPick(who, index, kind);
  }

  bringHere(index: TileIndex): void {
    const who = this.people.carrierFor(index);
    if (who !== NOBODY) this.people.sendToBring(who, index);
  }

  experiment(index: TileIndex): void {
    const who = this.people.knapperFor(index);
    if (who !== NOBODY) this.people.sendToKnap(who, index);
  }

  chopWood(index: TileIndex): void {
    const who = this.people.chopperFor(index);
    if (who !== NOBODY) this.people.sendToChop(who, index);
  }

  private groundItems(tile: Tile): string | null {
    const { items } = this.world;
    const kinds = items.kindsAt(tile.index);
    if (kinds.length === 0) return null;
    return kinds.map((kind) => `${items.tally(tile.index, kind)} ${ITEM_NAMES[kind]}`).join(', ');
  }

  private syncSky(): void {
    this.sky.setCalendar(this.clock, this.season);
    this.sky.advanceTo(this.elapsed);
  }

  advanceLight(seconds: number): void {
    if (this.speed > 0) {
      this.playTime += seconds * this.speed;
      this.calendar.advanceByDays((seconds * this.speed) / DAY_SECONDS);
      this.world.grow((seconds * this.speed) / DAY_SECONDS);
      this.world.fade((seconds * this.speed) / DAY_SECONDS);
    }
    this.syncSky();
    this.refreshSkyline();
  }

  setForced(index: number): void {
    this.dial = index;
    this.sky.forcedWeather = FORCED_WEATHER_CHOICES[index] ?? null;
    this.publish();
  }

  setSpeed(speed: number): void {
    if (this.trial) return;
    if (speed > 0) this.resumeSpeed = speed;
    this.speed = speed;
    this.publish();
  }

  togglePause(): void {
    this.setSpeed(this.speed > 0 ? 0 : this.resumeSpeed);
  }

  cycleSpeed(): void {
    this.setSpeed((this.speed % SPEED_STEPS) + 1);
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

    if (this.tool === 'clear') this.world.clear(index);
    else if (this.tool === 'tread') this.world.tread(index, 48);
    else if (this.tool === 'bolt') this.sky.lightning.strikeGroundAt(index);
    else if (this.tool === 'uproot') this.world.fell(index);

    this.publish();
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

    const lying = this.groundItems(tile);

    return [
      ...(lying ? ([['on the ground', lying]] as const) : []),
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
      forced: this.dial,
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

export const game = new Game(launch.slot, launch.seed, launch.mode);
