import { Calendar } from '../calendar.ts';
import { SHOAL_CAPACITY, Shoals } from '../fish/shoals.ts';
import type { Vec2 } from '../geometry.ts';
import { People } from '../people/people.ts';
import type { Thought } from '../people/thoughts.ts';
import type { GameMode } from '../simulation.ts';
import { WEATHER_STEP } from '../terrain/weather.ts';
import { SkyMirror } from '../weather/skyView.ts';
import { WeatherGrid } from '../weather/weatherGrid.ts';
import { World } from '../world.ts';
import type { ShoalFrame } from '../fish/shoals.ts';
import type { Frame, Hello } from './protocol.ts';

const FRAME_SECONDS = 1 / 30;
const LONGEST_EXTRAPOLATION_SECONDS = 0.1;

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

export class Replica {
  readonly seed: number;
  readonly mode: GameMode;
  readonly spot: Vec2;
  readonly world: World;
  readonly people: People;
  readonly sky: SkyMirror;
  readonly shoals = new Shoals();
  readonly calendar = new Calendar();

  speed = 1;
  playTime = 0;
  forced = 0;
  trialOpen = false;
  achievements: readonly string[] = [];
  tick = 0;

  private thoughts: Thought[][] = [];
  private readonly fromX: Float32Array;
  private readonly fromY: Float32Array;
  private readonly toX: Float32Array;
  private readonly toY: Float32Array;
  private receivedAt: number;
  private readonly shoalFromX = new Float32Array(SHOAL_CAPACITY);
  private readonly shoalFromY = new Float32Array(SHOAL_CAPACITY);
  private readonly shoalToX = new Float32Array(SHOAL_CAPACITY);
  private readonly shoalToY = new Float32Array(SHOAL_CAPACITY);
  private shoalsAt: number;
  private shoalInterval = FRAME_SECONDS * 3;
  private interval = FRAME_SECONDS;

  constructor(hello: Hello, now: number) {
    this.seed = hello.seed;
    this.mode = hello.mode;
    this.spot = hello.spot;
    this.world = World.mirror(hello.seed, hello.ground);
    this.people = new People(this.world, null, hello.count);
    const weather = this.world.field.weather;
    const grid = new WeatherGrid(weather.columns, weather.rows);
    this.sky = new SkyMirror(
      grid,
      (column, row) => grid.clampedCellIndex(Math.floor(column / WEATHER_STEP), Math.floor(row / WEATHER_STEP)),
      hello.frame.sky,
    );
    this.fromX = new Float32Array(this.people.posX.length);
    this.fromY = new Float32Array(this.people.posY.length);
    this.toX = new Float32Array(this.people.posX.length);
    this.toY = new Float32Array(this.people.posY.length);
    this.receivedAt = now;
    this.shoalsAt = now;
    this.apply(hello.frame, now);
    this.fromX.set(this.toX);
    this.fromY.set(this.toY);
    this.shoalFromX.set(this.shoalToX);
    this.shoalFromY.set(this.shoalToY);
  }

  get free(): boolean {
    return this.mode === 'discover' || this.achievements.includes('fire');
  }

  thoughtsOf(person: number): readonly Thought[] {
    return this.thoughts[person] ?? [];
  }

  apply(frame: Frame, now: number): void {
    this.fromX.set(this.people.posX);
    this.fromY.set(this.people.posY);
    this.world.apply(frame.world);
    this.people.unpack(frame.people);
    this.toX.set(this.people.posX);
    this.toY.set(this.people.posY);
    if (frame.fish) this.takeShoals(frame.fish, now);
    this.sky.apply(frame.sky);
    if (frame.thoughts) this.thoughts = frame.thoughts;
    this.calendar.restore(frame.calendar);
    this.world.plants.phase = this.calendar.seasonPhase;
    this.speed = frame.speed;
    this.playTime = frame.playTime;
    this.forced = frame.forced;
    this.trialOpen = frame.trialOpen;
    this.achievements = frame.achievements;
    this.tick = frame.tick;
    this.interval = Math.min(0.1, Math.max(0.016, (now - this.receivedAt) / 1000));
    this.receivedAt = now;
  }

  private takeShoals(frame: ShoalFrame, now: number): void {
    const { shoals } = this;
    const before = shoals.n;
    this.shoalFromX.set(shoals.posX.subarray(0, before));
    this.shoalFromY.set(shoals.posY.subarray(0, before));
    const alive = new Uint8Array(shoals.species.subarray(0, before));
    shoals.unpack(frame);
    for (let at = 0; at < shoals.n; at += 1) {
      if (at >= before || alive[at] === 0) {
        this.shoalFromX[at] = shoals.posX[at]!;
        this.shoalFromY[at] = shoals.posY[at]!;
      }
    }
    this.shoalToX.set(shoals.posX.subarray(0, shoals.n));
    this.shoalToY.set(shoals.posY.subarray(0, shoals.n));
    this.shoalInterval = Math.min(0.4, Math.max(0.05, (now - this.shoalsAt) / 1000));
    this.shoalsAt = now;
  }

  interpolate(now: number): void {
    const shoalT = clamp01((now - this.shoalsAt) / 1000 / this.shoalInterval);
    const { shoals } = this;
    for (let at = 0; at < shoals.n; at += 1) {
      shoals.posX[at] = this.shoalFromX[at]! + (this.shoalToX[at]! - this.shoalFromX[at]!) * shoalT;
      shoals.posY[at] = this.shoalFromY[at]! + (this.shoalToY[at]! - this.shoalFromY[at]!) * shoalT;
    }
    const t = clamp01((now - this.receivedAt) / 1000 / this.interval);
    const { posX, posY } = this.people;
    for (let person = 0; person < this.people.count; person += 1) {
      posX[person] = this.fromX[person]! + (this.toX[person]! - this.fromX[person]!) * t;
      posY[person] = this.fromY[person]! + (this.toY[person]! - this.fromY[person]!) * t;
    }
  }

  playTimeAt(now: number): number {
    return this.playTime + Math.min(LONGEST_EXTRAPOLATION_SECONDS, (now - this.receivedAt) / 1000) * this.speed;
  }
}
