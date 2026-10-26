import type { Achievement } from './achievements.ts';
import { Achievements } from './achievements.ts';
import type { CalendarState } from './calendar.ts';
import { Calendar, DAY_SECONDS } from './calendar.ts';
import { daylightAt, placeOf } from './daylight.ts';
import { DEFAULT_TUNING, Fauna } from './fauna/fauna.ts';
import type { FaunaWeather } from './fauna/fauna.ts';
import { PATCH_TILES } from './fauna/life.ts';
import { Fish } from './fish/fish.ts';
import type { FishEnvironment } from './fish/fish.ts';
import type { TileIndex } from './grid.ts';
import { NOWHERE } from './grid.ts';
import type { Vec2 } from './geometry.ts';
import type { ItemType } from './people/items.ts';
import type { LightSpot, PeopleEnvironment, PeopleState } from './people/people.ts';
import { NOBODY, People } from './people/people.ts';
import type { TrialOutcome } from './discovery/trial.ts';
import type { Thought } from './people/thoughts.ts';
import { thoughtsFor } from './people/thoughts.ts';
import { emittersIn, warmthFrom } from './sources/emitters.ts';
import { WORLD_EXTENT } from './terrain/terrain.ts';
import { FORCED_WEATHER_CHOICES } from './weather/forcedWeather.ts';
import { Sky } from './weather/sky.ts';
import { seasonalTemperatureSwing, yearlyTemperatureCycle } from './weather/temperature.ts';
import { clampBetween } from './weather/weatherMath.ts';
import type { WorldState } from './world.ts';
import { World } from './world.ts';

export type GameMode = 'settle' | 'discover';

export type ToolKind = 'clear' | 'tread' | 'bolt' | 'uproot';

export type TileCommand =
  | 'lightTorch'
  | 'planCampfire'
  | 'planRelight'
  | 'addFuel'
  | 'cancelPlan'
  | 'plantTorch'
  | 'layFloor'
  | 'clearFloor'
  | 'designateStorage'
  | 'clearStorage'
  | 'bringHere'
  | 'experiment'
  | 'chopWood';

export type Command =
  | { kind: 'setSpeed'; speed: number }
  | { kind: 'togglePause' }
  | { kind: 'cycleSpeed' }
  | { kind: 'setMinutes'; minutes: number }
  | { kind: 'skip'; hours: number }
  | { kind: 'setSeason'; phase: number }
  | { kind: 'setMoon'; phase: number }
  | { kind: 'setForced'; index: number }
  | { kind: 'use'; tool: ToolKind; tile: TileIndex }
  | { kind: TileCommand; tile: TileIndex }
  | { kind: 'pickUp'; tile: TileIndex; item: ItemType }
  | { kind: 'commitTrial'; person: number; outcome: TrialOutcome };

export type SimEvent =
  | { kind: 'achievement'; achievement: Achievement }
  | { kind: 'trial'; person: number; tile: TileIndex; items: readonly ItemType[]; seed: number }
  | { kind: 'changed' };

export interface Carry {
  calendar: CalendarState;
  speed: number;
  playTime: number;
}

export interface SimState {
  calendar: CalendarState;
  speed: number;
  playTime: number;
  achievements: string[];
  people: PeopleState;
  world: WorldState;
}

type Listener = (event: SimEvent) => void;

const SKIP_STEP_SECONDS = 5;
const THOUGHT_SECONDS = 0.5;
const LIGHT_SEEK_TILES = 60;
const SLEEP_BY_FIRE_TILES = 2.2;
const SLEEP_BY_TORCH_TILES = 1.2;
const SPEED_STEPS = 3;
const FOG_CLEAR_TILES = 7;
const CONFINE_TILES = FOG_CLEAR_TILES + 4;
const FOG_OPENED_TILES = 26;
const CONFINE_OPENED_TILES = FOG_OPENED_TILES - 2;
const CLEAR_TREAD_WEAR = 48;

const OPEN_STRIDE = 7;
const CLIMATE_SECONDS = 2;
const FAUNA_SPIN_UP_SWEEPS = 8;
const FAUNA_SPIN_UP_DAYS = 0.25;
const WATER_FOLLOWS_YEAR = 0.7;

export function openingSpot(world: World): Vec2 {
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

export class Simulation {
  readonly world: World;
  readonly mode: GameMode;
  readonly calendar = new Calendar();
  readonly sky: Sky;
  readonly spot: Vec2;
  people!: People;
  readonly fish: Fish;
  readonly fauna: Fauna;
  achievements!: Achievements;

  speed = 1;
  playTime = 0;
  forced = 0;
  trialOpen = false;

  private faunaClimate!: FaunaWeather;
  private faunaCelsius = new Float32Array(0);
  private climateClock = 0;
  private resumeSpeed = 1;
  private speedBeforeTrial = 1;
  private thoughts: Thought[][] = [];
  private thoughtClock = 0;
  thoughtRevision = 0;
  private readonly listeners = new Set<Listener>();

  constructor(seed: number, mode: GameMode, saved: SimState | null, carry: Carry | null = null) {
    this.mode = mode;
    this.world = World.generate(seed);
    if (carry) {
      this.calendar.restore(carry.calendar);
      this.speed = carry.speed;
      this.playTime = carry.playTime;
      this.resumeSpeed = carry.speed > 0 ? carry.speed : 1;
    }
    if (saved) this.calendar.restore(saved.calendar);
    this.sky = new Sky(this.world, this.calendar.elapsedDays);
    this.spot = openingSpot(this.world);
    this.settle();
    if (saved) this.resume(saved);
    this.fauna = new Fauna(this.world, seed, { ...DEFAULT_TUNING, maxStep: FAUNA_SPIN_UP_DAYS });
    this.fish = new Fish(this.world, seed, this.fauna);
    this.fish.populate(this.waters);
    this.fish.measure();
    this.fauna.populate();
    this.spinUpFauna();
  }

  private faunaWeather(): FaunaWeather {
    const { world, sky, fauna } = this;
    const { columns, count } = fauna.patches;
    const cellOf = new Int32Array(count);
    for (let patch = 0; patch < count; patch += 1) {
      const column = Math.min(world.grid.columns - 1, (patch % columns) * PATCH_TILES + PATCH_TILES / 2);
      const row = Math.min(world.grid.rows - 1, Math.floor(patch / columns) * PATCH_TILES + PATCH_TILES / 2);
      cellOf[patch] = sky.cellContainingTile(column, row);
    }
    this.faunaCelsius = new Float32Array(sky.temperature.surfaceTemperature.length);
    this.refreshClimate();
    return { celsius: this.faunaCelsius, snow: sky.groundSurface.snowCover, cellOf };
  }

  private refreshClimate(): void {
    const weather = this.world.field.weather;
    const cycle = yearlyTemperatureCycle(this.calendar.seasonPhase);
    for (let cell = 0; cell < this.faunaCelsius.length; cell += 1) {
      this.faunaCelsius[cell] = weather.warmth[cell]! + cycle * seasonalTemperatureSwing(weather.latitude[cell]!, clampBetween(weather.standing[cell]!));
    }
  }

  private spinUpFauna(): void {
    this.faunaClimate = this.faunaWeather();
    for (let sweep = 0; sweep < FAUNA_SPIN_UP_SWEEPS; sweep += 1) {
      this.fish.update(0, FAUNA_SPIN_UP_DAYS, this.waters);
      this.fauna.sweep(FAUNA_SPIN_UP_DAYS, this.faunaClimate);
    }
  }

  private settle(): void {
    this.people = new People(this.world, this.mode === 'settle' ? this.spot : null);
    if (this.mode === 'settle') this.world.confine(this.world.grid.atPoint(this.spot), CONFINE_TILES);
    this.achievements = new Achievements();
    this.achievements.subscribe((achievement) => {
      this.widen();
      this.emit({ kind: 'achievement', achievement });
    });
    this.people.subscribe((event) => {
      if (event.kind === 'trial') this.openTrial(event.person, event.tile);
    });
  }

  private resume(saved: SimState): void {
    this.world.restore(saved.world);
    this.people.restore(saved.people);
    this.people.endAllTrials();
    this.achievements.restore(saved.achievements);
    this.speed = saved.speed;
    this.playTime = saved.playTime;
    if (this.mode === 'settle' && this.free) this.widen();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SimEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  get free(): boolean {
    return this.mode === 'discover' || this.achievements.has('fire');
  }

  get clock(): number {
    return this.calendar.timeOfDay;
  }

  get elapsed(): number {
    return this.calendar.elapsedDays;
  }

  get season(): number {
    return this.calendar.seasonPhase;
  }

  get moon(): number {
    return this.calendar.moonPhase;
  }

  allThoughts(): Thought[][] {
    return this.thoughts;
  }

  thoughtsOf(person: number): readonly Thought[] {
    return this.thoughts[person] ?? [];
  }

  private widen(): void {
    if (this.mode === 'discover') return;
    this.world.confine(this.world.grid.atPoint(this.spot), CONFINE_OPENED_TILES);
  }

  private openTrial(person: number, tile: TileIndex): void {
    if (this.trialOpen) return;
    const { items } = this.world;
    const kinds = items.at(tile).map((slot) => items.kind[slot]! as ItemType);
    this.trialOpen = true;
    this.speedBeforeTrial = this.speed > 0 ? this.speed : this.resumeSpeed;
    this.speed = 0;
    this.emit({ kind: 'trial', person, tile, items: kinds, seed: this.world.seed ^ Math.floor(this.calendar.elapsedDays * 1e4) });
  }

  private commitTrial(person: number, outcome: TrialOutcome): void {
    const { items } = this.world;
    for (const slot of [...items.at(outcome.tile)]) items.remove(slot);
    for (const kind of outcome.kept) items.add(outcome.tile, kind);
    if (outcome.axe) this.people.knowledge.hasDiscoveredFlintKnapping = true;
    this.people.endTrial(person);
    this.trialOpen = false;
    this.apply({ kind: 'setSpeed', speed: this.speedBeforeTrial });
  }

  apply(command: Command): void {
    const { world, people, sky } = this;
    switch (command.kind) {
      case 'setSpeed':
        if (this.trialOpen) return;
        if (command.speed > 0) this.resumeSpeed = command.speed;
        this.speed = command.speed;
        break;
      case 'togglePause':
        this.apply({ kind: 'setSpeed', speed: this.speed > 0 ? 0 : this.resumeSpeed });
        return;
      case 'cycleSpeed':
        this.apply({ kind: 'setSpeed', speed: (this.speed % SPEED_STEPS) + 1 });
        return;
      case 'setMinutes':
        this.calendar.setMinuteOfDay(command.minutes);
        this.syncSky();
        break;
      case 'skip':
        this.skip(command.hours);
        break;
      case 'setSeason':
        this.calendar.setSeasonPhase(command.phase);
        this.syncSky();
        break;
      case 'setMoon':
        this.calendar.setMoonPhase(command.phase);
        break;
      case 'setForced':
        this.forced = command.index;
        sky.forcedWeather = FORCED_WEATHER_CHOICES[command.index] ?? null;
        break;
      case 'use':
        if (command.tile === NOWHERE) return;
        if (command.tool === 'clear') world.clear(command.tile);
        else if (command.tool === 'tread') world.tread(command.tile, CLEAR_TREAD_WEAR);
        else if (command.tool === 'bolt') sky.lightning.strikeGroundAt(command.tile);
        else world.fell(command.tile);
        break;
      case 'lightTorch': {
        const who = people.lighterFor(command.tile);
        if (who !== NOBODY) people.sendToLight(who, command.tile);
        break;
      }
      case 'planCampfire':
      case 'planRelight': {
        const planned = command.kind === 'planCampfire' ? world.planCampfire(command.tile) : world.planRelight(command.tile);
        if (!planned) return;
        const who = people.builderFor(command.tile);
        if (who !== NOBODY) people.sendToBuild(who, command.tile);
        break;
      }
      case 'addFuel': {
        const who = people.feederFor(command.tile);
        if (who !== NOBODY) people.sendToFeed(who, command.tile);
        break;
      }
      case 'cancelPlan':
        people.abandonPlan(command.tile);
        world.unplan(command.tile);
        break;
      case 'plantTorch': {
        const who = people.planterFor(command.tile);
        if (who !== NOBODY) people.sendToPlant(who, command.tile);
        break;
      }
      case 'layFloor':
        world.layFloor(command.tile);
        break;
      case 'clearFloor':
        world.unfloor(command.tile);
        break;
      case 'designateStorage':
        world.designate(command.tile);
        break;
      case 'clearStorage':
        world.release(command.tile);
        break;
      case 'pickUp': {
        const who = people.pickerFor(command.tile);
        if (who !== NOBODY) people.sendToPick(who, command.tile, command.item);
        break;
      }
      case 'bringHere': {
        const who = people.carrierFor(command.tile);
        if (who !== NOBODY) people.sendToBring(who, command.tile);
        break;
      }
      case 'experiment': {
        const who = people.knapperFor(command.tile);
        if (who !== NOBODY) people.sendToKnap(who, command.tile);
        break;
      }
      case 'chopWood': {
        const who = people.chopperFor(command.tile);
        if (who !== NOBODY) people.sendToChop(who, command.tile);
        break;
      }
      case 'commitTrial':
        this.commitTrial(command.person, command.outcome);
        break;
    }
    this.emit({ kind: 'changed' });
  }

  private skip(hours: number): void {
    if (this.trialOpen || !(hours > 0)) return;
    const speed = this.speed;
    this.speed = 1;
    for (let left = hours * (DAY_SECONDS / 24); left > 0; left -= SKIP_STEP_SECONDS) this.advance(Math.min(SKIP_STEP_SECONDS, left));
    this.speed = speed;
  }

  private syncSky(): void {
    this.sky.setCalendar(this.clock, this.season);
    this.sky.advanceTo(this.elapsed);
  }

  private readonly surroundings: PeopleEnvironment = {
    temperatureAt: (tile) => {
      const { world, sky } = this;
      return sky.temperature.surfaceTemperature[sky.cellContainingTile(world.grid.columnOf(tile), world.grid.rowOf(tile))]!;
    },
    warmthAt: (x, y) => warmthFrom(emittersIn(this.world, this.people), x, y),
    gloomAt: (x, y) => daylightAt(this.calendar.moment, placeOf(this.world.grid, this.world.seed, { x, y })).gloom,
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

  private readonly waters: FishEnvironment = {
    temperatureAt: (tile) => {
      const { world, sky } = this;
      const cell = sky.cellContainingTile(world.grid.columnOf(tile), world.grid.rowOf(tile));
      return WATER_FOLLOWS_YEAR * world.field.temperature[tile]! + (1 - WATER_FOLLOWS_YEAR) * sky.temperature.surfaceTemperature[cell]!;
    },
    daylightAt: (x, y) => daylightAt(this.calendar.moment, placeOf(this.world.grid, this.world.seed, { x, y })).daylight,
  };

  advance(seconds: number): void {
    const scaled = seconds * this.speed;
    this.world.plants.phase = this.calendar.seasonPhase;
    this.world.burn(scaled);
    this.people.update(scaled, this.surroundings);
    if (scaled > 0) {
      this.fish.update(scaled, scaled / DAY_SECONDS, this.waters);
      this.climateClock += seconds;
      if (this.climateClock >= CLIMATE_SECONDS) {
        this.climateClock = 0;
        this.refreshClimate();
      }
      this.fauna.update(scaled / DAY_SECONDS, this.faunaClimate);
    }
    this.achievements.check(this.people);
    this.thoughtClock -= seconds;
    if (this.thoughtClock <= 0) {
      this.thoughtClock = THOUGHT_SECONDS;
      this.rethink();
    }
    if (this.speed > 0) {
      this.playTime += scaled;
      this.calendar.advanceByDays(scaled / DAY_SECONDS);
      this.world.grow(scaled / DAY_SECONDS, this.calendar.seasonPhase);
      this.world.fade(scaled / DAY_SECONDS);
    }
    this.syncSky();
  }

  private rethink(): void {
    const { world, sky, people } = this;
    this.thoughtRevision += 1;
    this.thoughts = [];
    for (let person = 0; person < people.count; person += 1) {
      const x = people.posX[person]!;
      const y = people.posY[person]!;
      const cell = sky.cellContainingTile(world.grid.column(x), world.grid.row(y));
      this.thoughts.push(
        thoughtsFor(people, person, {
          rain: sky.precipitation.rain[cell]!,
          snow: sky.precipitation.snowfall[cell]!,
          gloom: daylightAt(this.calendar.moment, placeOf(world.grid, world.seed, { x, y })).gloom,
        }),
      );
    }
  }

  snapshot(): SimState {
    return {
      calendar: this.calendar.state(),
      speed: this.trialOpen ? this.speedBeforeTrial : this.speed,
      playTime: this.playTime,
      achievements: [...this.achievements.ids],
      people: this.people.snapshot(),
      world: this.world.snapshot(),
    };
  }
}
