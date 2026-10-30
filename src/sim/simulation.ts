import type { Achievement } from '../modules/achievements/api.ts';
import type { Achievements } from '../modules/achievements/api.ts';
import type { CalendarState } from './calendar.ts';
import type { Calendar } from './calendar.ts';
import { CALENDAR, CARRY, CLOCK, EVENTS, MODE, SAVED, SEED, SPOT, TRIAL, WORLD } from './capabilities.ts';
import { EMITTER_SOURCES } from '../modules/light/api.ts';
import { EARNED } from '../modules/achievements/api.ts';
import { FAUNA_GROUPS } from '../modules/fauna/api.ts';
import { MIND } from '../modules/mind/api.ts';
import { PEOPLE } from '../modules/people/api.ts';
import { SKY } from '../modules/weather/api.ts';
import { Events } from './events.ts';
import type { Vec2 } from './geometry.ts';
import type { TileIndex } from './grid.ts';
import { Kernel, provide } from './kernel/kernel.ts';
import type { Tick } from './kernel/kernel.ts';
import type { MindState } from '../modules/mind/api.ts';
import type { Mind } from '../modules/mind/api.ts';
import { GAME_MODULES } from '../modules/index.ts';
import { THOUGHTS } from '../modules/thoughts/module.ts';
import type { SimModule } from './kernel/module.ts';
import type { ItemType } from '../modules/items/api.ts';
import type { People, PeopleState } from '../modules/people/api.ts';
import type { Thought } from '../modules/thoughts/api.ts';
import { FORCED_WEATHER_CHOICES } from '../modules/weather/api.ts';
import type { Sky } from '../modules/weather/api.ts';
import type { WorldState } from './world.ts';
import type { World } from './world.ts';

export { openingSpot } from './spot.ts';

export type GameMode = 'settle' | 'discover';

export interface Command {
  kind: string;
  [key: string]: unknown;
}

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
  mind?: MindState;
  world: WorldState;
}

type Listener = (event: SimEvent) => void;

export class Simulation {
  readonly kernel: Kernel;
  private readonly events = new Events<SimEvent>();
  private readonly tick: Tick = { seconds: 0, scaled: 0 };

  constructor(
    seed: number,
    readonly mode: GameMode,
    saved: SimState | null,
    carry: Carry | null = null,
    modules: readonly SimModule[] = GAME_MODULES,
  ) {
    this.kernel = new Kernel(
      modules.flatMap((module) => module.systems),
      [provide(SEED, seed), provide(MODE, mode), provide(SAVED, saved), provide(CARRY, carry), provide(EVENTS, this.events), provide(EMITTER_SOURCES, modules.flatMap((module) => module.emitters)), provide(FAUNA_GROUPS, new Set(modules.flatMap((module) => (module.kind && module.kind.group !== 'human' ? [module.kind.group] : []))))],
    );
  }

  get world(): World {
    return this.kernel.get(WORLD);
  }

  get calendar(): Calendar {
    return this.kernel.get(CALENDAR);
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

  get sky(): Sky {
    return this.kernel.get(SKY);
  }

  get spot(): Vec2 {
    return this.kernel.get(SPOT);
  }

  get people(): People {
    return this.kernel.get(PEOPLE);
  }

  get mind(): Mind {
    return this.kernel.get(MIND);
  }

  get achievements(): Achievements {
    return this.kernel.get(EARNED);
  }

  get speed(): number {
    return this.kernel.get(CLOCK).speed;
  }

  get playTime(): number {
    return this.kernel.get(CLOCK).playTime;
  }

  get forced(): number {
    return Math.max(0, FORCED_WEATHER_CHOICES.indexOf(this.sky.forcedWeather));
  }

  get trialOpen(): boolean {
    return this.kernel.find(TRIAL)?.open ?? false;
  }

  get free(): boolean {
    return this.mode === 'discover' || this.achievements.has('fire');
  }

  get thoughtRevision(): number {
    return this.kernel.find(THOUGHTS)?.revision ?? 0;
  }

  allThoughts(): Thought[][] {
    return this.kernel.find(THOUGHTS)?.all ?? [];
  }

  thoughtsOf(person: number): readonly Thought[] {
    return this.allThoughts()[person] ?? [];
  }

  subscribe(listener: Listener): () => void {
    return this.events.subscribe(listener);
  }

  apply(command: Command): void {
    const name = command.kind === 'use' ? `use.${String(command.tool)}` : command.kind;
    if (!this.kernel.has(name)) return;
    if (this.kernel.run(name, command) !== false) this.events.emit({ kind: 'changed' });
  }

  advance(seconds: number): void {
    const { tick } = this;
    tick.seconds = seconds;
    tick.scaled = seconds * this.speed;
    this.kernel.update(tick);
  }

  snapshot(): SimState {
    return this.kernel.snapshot() as unknown as SimState;
  }
}
