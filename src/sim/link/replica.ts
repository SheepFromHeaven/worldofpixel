import { ANIMAL_CAPACITY, AnimalStore, EMPTY } from '../animals/store.ts';
import type { AnimalFrame } from '../animals/store.ts';
import { Calendar } from '../calendar.ts';
import type { FaunaMirror } from '../fauna/pack.ts';
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
  readonly animals = new AnimalStore();
  fauna: FaunaMirror | null = null;
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
  private readonly animalFromX = new Float32Array(ANIMAL_CAPACITY);
  private readonly animalFromY = new Float32Array(ANIMAL_CAPACITY);
  private readonly animalFromTravel = new Float32Array(ANIMAL_CAPACITY);
  private readonly animalFromZ = new Float32Array(ANIMAL_CAPACITY);
  private readonly animalToZ = new Float32Array(ANIMAL_CAPACITY);
  private readonly animalToX = new Float32Array(ANIMAL_CAPACITY);
  private readonly animalToY = new Float32Array(ANIMAL_CAPACITY);
  private readonly animalToTravel = new Float32Array(ANIMAL_CAPACITY);
  private animalsAt: number;
  private animalInterval = FRAME_SECONDS * 2;
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
    this.animalsAt = now;
    this.apply(hello.frame, now);
    this.fromX.set(this.toX);
    this.fromY.set(this.toY);
    this.shoalFromX.set(this.shoalToX);
    this.shoalFromY.set(this.shoalToY);
    this.animalFromX.set(this.animalToX);
    this.animalFromY.set(this.animalToY);
    this.animalFromTravel.set(this.animalToTravel);
    this.animalFromZ.set(this.animalToZ);
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
    if (frame.animals) this.takeAnimals(frame.animals, now);
    if (frame.fauna) {
      const { columns, rows, levels, suit, version } = frame.fauna;
      const kept = suit ?? this.fauna?.suit;
      if (kept) this.fauna = { columns, rows, levels, suit: kept, version };
    }
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

  private takeAnimals(frame: AnimalFrame, now: number): void {
    const { animals } = this;
    const before = animals.n;
    this.animalFromX.set(animals.posX.subarray(0, before));
    this.animalFromY.set(animals.posY.subarray(0, before));
    this.animalFromTravel.set(animals.travelled.subarray(0, before));
    this.animalFromZ.set(animals.posZ.subarray(0, before));
    const was = new Uint8Array(animals.species.subarray(0, before));
    animals.unpack(frame);
    for (let at = 0; at < animals.n; at += 1) {
      if (at >= before || was[at] !== animals.species[at] || animals.species[at] === EMPTY) {
        this.animalFromX[at] = animals.posX[at]!;
        this.animalFromY[at] = animals.posY[at]!;
        this.animalFromTravel[at] = animals.travelled[at]!;
        this.animalFromZ[at] = animals.posZ[at]!;
      }
    }
    this.animalToX.set(animals.posX.subarray(0, animals.n));
    this.animalToY.set(animals.posY.subarray(0, animals.n));
    this.animalToTravel.set(animals.travelled.subarray(0, animals.n));
    this.animalToZ.set(animals.posZ.subarray(0, animals.n));
    this.animalInterval = Math.min(0.4, Math.max(0.03, (now - this.animalsAt) / 1000));
    this.animalsAt = now;
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
    const animalT = clamp01((now - this.animalsAt) / 1000 / this.animalInterval);
    const { animals } = this;
    for (let at = 0; at < animals.n; at += 1) {
      if (animals.species[at] === EMPTY) continue;
      animals.posX[at] = this.animalFromX[at]! + (this.animalToX[at]! - this.animalFromX[at]!) * animalT;
      animals.posY[at] = this.animalFromY[at]! + (this.animalToY[at]! - this.animalFromY[at]!) * animalT;
      animals.travelled[at] = this.animalFromTravel[at]! + (this.animalToTravel[at]! - this.animalFromTravel[at]!) * animalT;
      animals.posZ[at] = this.animalFromZ[at]! + (this.animalToZ[at]! - this.animalFromZ[at]!) * animalT;
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
