import type { TileIndex } from '../grid.ts';
import { NOWHERE } from '../grid.ts';
import { ITEM_NAMES, ItemType } from '../people/items.ts';
import type { People } from '../people/people.ts';
import { BODY_TEMP_COLD, EntityState } from '../people/people.ts';
import type { Chain } from './neurons.ts';
import { GOALS, MAX_RING, NEURONS, NEURON_COUNT, Outcome, chainOf, neuronIndex, neuronOf, polar, recipeFor, recipeMaking } from './neurons.ts';

export const Heard = 1;

export const Known = 2;

export const State = { Open: 0, Success: 1, Weak: 2, Scar: 3 } as const;

export type State = (typeof State)[keyof typeof State];

export const MAX_OPEN = 3;

export const DEAD_SECONDS = 70;

export const NOTICE_TILES = 7;

export const SEE_TILES = 6;

export const SHARE_TILES = 3;

export const SHARE_SECONDS = 24;

export const FIRE_SHARE_BONUS = 2.5;

export const PULSE_SECONDS = 1.6;

const NOTICE_SECONDS = 0.5;

const MIN_CURIOUS = 0.12;

const RETRY_SECONDS = 25;

const HUNGRY_LIMIT = 0.8;

const THIRSTY_LIMIT = 0.8;

const TIRED_LIMIT = 0.85;

const TALK_REACH_TILES = 90;

export interface Hypothesis {
  id: number;
  a: number;
  b: number;
  state: State;
  result: number;
  tryer: number;
  partner: number;
  order: boolean;
  tile: TileIndex;
  note: string;
  retryAt: number;
  age?: number;
}

export interface Job {
  id: number;
  partner: number;
  tile: TileIndex;
}

export interface MindState {
  known: number[];
  hypotheses: Hypothesis[];
  next: number;
}

export interface NeuronView {
  index: number;
  x: number;
  y: number;
  holders: readonly number[];
  proven: boolean;
}

export interface HypothesisView {
  id: number;
  a: number;
  b: number;
  state: State;
  result: number;
  x: number;
  y: number;
  tryer: number;
  partner: number;
  order: boolean;
  note: string;
  age: number;
}

export interface MindView {
  revision: number;
  learned: number;
  people: number;
  neurons: readonly NeuronView[];
  hypotheses: readonly HypothesisView[];
  proven: readonly string[];
}

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

export class Mind {
  readonly known: Uint8Array;
  readonly hypotheses: Hypothesis[] = [];
  revision = 0;
  learned = 0;
  private next = 0;
  private now = 0;
  private noticeClock = 0;
  private shareClock = 0;
  private readonly spots = new Map<number, { x: number; y: number }>();

  constructor(private readonly people: People) {
    this.known = new Uint8Array(people.count * NEURON_COUNT);
  }

  level(person: number, neuron: number): number {
    return this.known[person * NEURON_COUNT + neuron] ?? 0;
  }

  knows(person: number, neuron: number): boolean {
    return this.level(person, neuron) >= Known;
  }

  anyone(neuron: number): boolean {
    for (let person = 0; person < this.people.count; person += 1) if (this.knows(person, neuron)) return true;
    return false;
  }

  proven(id: string): boolean {
    return this.anyone(neuronIndex(id));
  }

  learn(person: number, neuron: number, level: number): boolean {
    const at = person * NEURON_COUNT + neuron;
    if (neuron < 0 || (this.known[at] ?? 0) >= level) return false;
    this.known[at] = level;
    this.people.pulse[person] = PULSE_SECONDS;
    this.learned += 1;
    this.revision += 1;
    return true;
  }

  hypothesis(id: number): Hypothesis | null {
    return this.hypotheses.find((candidate) => candidate.id === id) ?? null;
  }

  jobOf(person: number): Hypothesis | null {
    return this.hypothesis(this.people.wonder[person]!);
  }

  open(): Hypothesis[] {
    return this.hypotheses.filter((hypothesis) => hypothesis.state === State.Open);
  }

  tried(a: number, b: number): boolean {
    return this.hypotheses.some((hypothesis) => !hypothesis.order && ((hypothesis.a === a && hypothesis.b === b) || (hypothesis.a === b && hypothesis.b === a)));
  }

  wonder(a: number, b: number): string | null {
    if (a < 0 || b < 0 || a >= NEURON_COUNT || b >= NEURON_COUNT) return 'not a neuron';
    if (!this.anyone(a) || !this.anyone(b)) return 'nobody has met that yet';
    if (this.tried(a, b)) return 'already tried';
    if (this.open().filter((hypothesis) => !hypothesis.order).length >= MAX_OPEN) return 'too many guesses at once';
    this.hypotheses.push({ id: this.next, a, b, state: State.Open, result: -1, tryer: -1, partner: -1, order: false, tile: NOWHERE, note: 'waiting', retryAt: 0 });
    this.next += 1;
    this.revision += 1;
    return null;
  }

  order(result: number, tile: TileIndex): string | null {
    const recipe = recipeMaking(result);
    if (!recipe || recipe.order === undefined || recipe.outcome !== Outcome.Success || !this.anyone(result)) return 'nobody knows how';
    if (recipe.station === 'floor' && !this.people.world.isFloor(tile)) return 'needs a knapping floor';
    const busy = this.hypotheses.some((hypothesis) => hypothesis.order && hypothesis.state === State.Open && hypothesis.tile === tile);
    if (busy) return 'already being made';
    this.hypotheses.push({ id: this.next, a: neuronIndex(recipe.a), b: neuronIndex(recipe.b), state: State.Open, result, tryer: -1, partner: -1, order: true, tile, note: 'waiting', retryAt: 0 });
    this.next += 1;
    this.revision += 1;
    return null;
  }

  cancel(id: number): void {
    const hypothesis = this.hypothesis(id);
    if (!hypothesis || hypothesis.state !== State.Open || hypothesis.tryer >= 0) return;
    this.hypotheses.splice(this.hypotheses.indexOf(hypothesis), 1);
    this.revision += 1;
  }

  chainOf(hypothesis: Hypothesis): Chain {
    return chainOf(hypothesis.a, hypothesis.b, recipeFor(hypothesis.a, hypothesis.b));
  }

  supply(kind: ItemType, besides: TileIndex = NOWHERE): number {
    const { items, floor, plan } = this.people.world;
    let found = 0;
    for (let slot = 0; slot < items.used; slot += 1) {
      if (items.kind[slot] !== kind) continue;
      const tile = items.tile[slot]!;
      if (tile !== besides && (floor[tile] === 1 || plan[tile] !== 0)) continue;
      found += 1;
    }
    for (let person = 0; person < this.people.count; person += 1) if (this.people.heldItemType[person] === kind) found += 1;
    return found;
  }

  shortOf(hypothesis: Hypothesis): ItemType {
    for (const [kind, count] of this.chainOf(hypothesis).needs) if (this.supply(kind) < count) return kind;
    return ItemType.None;
  }

  private comfort(person: number): number {
    const { people } = this;
    if (people.hunger[person]! > HUNGRY_LIMIT || people.thirst[person]! > THIRSTY_LIMIT || people.tiredness[person]! > TIRED_LIMIT) return 0;
    if (people.bodyTemp[person]! < BODY_TEMP_COLD) return 0;
    const fed = 1 - people.hunger[person]!;
    const watered = 1 - people.thirst[person]!;
    const rested = 1 - people.tiredness[person]!;
    return clamp01(0.25 + 0.75 * Math.min(fed, watered, rested));
  }

  curiosity(person: number): number {
    return this.people.curiosity[person]! * this.comfort(person);
  }

  private free(person: number): boolean {
    const state = this.people.state[person]!;
    return (state === EntityState.Idle || state === EntityState.Wander) && this.people.wonder[person] === -1;
  }

  private away(a: number, b: number): number {
    const { people } = this;
    return Math.hypot(people.posX[a]! - people.posX[b]!, people.posY[a]! - people.posY[b]!);
  }

  private partnerFor(person: number, hypothesis: Hypothesis): number {
    const lacking = [hypothesis.a, hypothesis.b].filter((neuron) => !this.knows(person, neuron));
    if (lacking.length === 0) return -1;
    let found = -1;
    let most = -1;
    for (let other = 0; other < this.people.count; other += 1) {
      if (other === person || !lacking.every((neuron) => this.knows(other, neuron))) continue;
      if (this.away(person, other) > TALK_REACH_TILES) continue;
      const wish = this.people.curiosity[other]!;
      if (wish > most) {
        most = wish;
        found = other;
      }
    }
    return found === -1 ? -2 : found;
  }

  claim(person: number): Job | null {
    if (!this.free(person)) return null;
    for (const hypothesis of this.hypotheses) {
      if (hypothesis.state !== State.Open || hypothesis.tryer >= 0 || this.now < hypothesis.retryAt) continue;
      if (hypothesis.order) {
        if (!this.nearestTo(hypothesis.tile, person)) continue;
        if (this.shortOf(hypothesis) !== ItemType.None) {
          this.hold(hypothesis, `needs ${neuronOf(hypothesis.a).item === ItemType.None ? 'material' : 'flint and stone'}`);
          continue;
        }
        return this.take(hypothesis, person, -1);
      }
      if (this.curiosity(person) < MIN_CURIOUS) continue;
      const best = this.mostCurious(hypothesis);
      if (best !== person) continue;
      const partner = this.partnerFor(person, hypothesis);
      if (partner === -2) continue;
      const short = this.shortOf(hypothesis);
      if (short !== ItemType.None) {
        this.hold(hypothesis, `no ${ITEM_NAMES[short] ?? 'item'} to try it with`);
        continue;
      }
      return this.take(hypothesis, person, partner);
    }
    return null;
  }

  private hold(hypothesis: Hypothesis, note: string): void {
    if (hypothesis.note === note) return;
    hypothesis.note = note;
    this.revision += 1;
  }

  private nearestTo(tile: TileIndex, person: number): boolean {
    const { people } = this;
    const at = people.world.grid.centre(tile);
    let nearest = -1;
    let least = Infinity;
    for (let other = 0; other < people.count; other += 1) {
      if (!this.free(other) || people.heldItemType[other] === ItemType.BurningBranch) continue;
      const gap = Math.hypot(people.posX[other]! - at.x, people.posY[other]! - at.y);
      if (gap < least) {
        least = gap;
        nearest = other;
      }
    }
    return nearest === person;
  }

  private mostCurious(hypothesis: Hypothesis): number {
    let best = -1;
    let most = MIN_CURIOUS;
    for (let person = 0; person < this.people.count; person += 1) {
      if (!this.free(person)) continue;
      const holds = [hypothesis.a, hypothesis.b].every((neuron) => this.knows(person, neuron));
      if (!holds && this.partnerFor(person, hypothesis) === -2) continue;
      const wish = this.curiosity(person);
      if (wish > most) {
        most = wish;
        best = person;
      }
    }
    return best;
  }

  private take(hypothesis: Hypothesis, person: number, partner: number): Job {
    hypothesis.tryer = person;
    hypothesis.partner = partner;
    hypothesis.note = partner >= 0 ? 'walking to talk' : 'fetching';
    this.revision += 1;
    return { id: hypothesis.id, partner, tile: hypothesis.order ? hypothesis.tile : NOWHERE };
  }

  say(hypothesis: Hypothesis, note: string): void {
    this.hold(hypothesis, note);
  }

  release(hypothesis: Hypothesis, note: string): void {
    hypothesis.tryer = -1;
    hypothesis.partner = -1;
    hypothesis.note = note;
    hypothesis.retryAt = this.now + RETRY_SECONDS;
    this.revision += 1;
  }

  talk(person: number, hypothesis: Hypothesis): void {
    for (const neuron of [hypothesis.a, hypothesis.b]) this.learn(person, neuron, Heard);
  }

  resolve(hypothesis: Hypothesis, person: number, viewers: readonly number[]): State {
    const recipe = recipeFor(hypothesis.a, hypothesis.b);
    hypothesis.tryer = -1;
    hypothesis.partner = -1;
    if (hypothesis.order) {
      this.hypotheses.splice(this.hypotheses.indexOf(hypothesis), 1);
      this.revision += 1;
      return State.Success;
    }
    if (!recipe) {
      hypothesis.state = State.Scar;
      hypothesis.note = 'nothing happened';
    } else {
      const result = neuronIndex(recipe.result);
      hypothesis.state = recipe.outcome === Outcome.Success ? State.Success : State.Weak;
      hypothesis.result = result;
      hypothesis.note = recipe.title.toLowerCase();
      for (const seer of [person, ...viewers]) {
        this.learn(seer, neuronIndex(recipe.a), Known);
        this.learn(seer, neuronIndex(recipe.b), Known);
        this.learn(seer, result, Known);
      }
    }
    this.revision += 1;
    return hypothesis.state;
  }

  achieved(): readonly string[] {
    return GOALS.filter((goal) => this.proven(goal));
  }

  update(seconds: number): void {
    this.now += seconds;
    for (const hypothesis of this.hypotheses) {
      if (hypothesis.state === State.Open && hypothesis.tryer >= 0 && this.people.wonder[hypothesis.tryer] !== hypothesis.id) this.release(hypothesis, 'dropped, waiting');
    }
    for (const hypothesis of this.hypotheses) {
      if (hypothesis.state !== State.Scar || (hypothesis.age ?? 0) >= DEAD_SECONDS) continue;
      hypothesis.age = (hypothesis.age ?? 0) + seconds;
      if (hypothesis.age >= DEAD_SECONDS) this.revision += 1;
    }
    this.noticeClock -= seconds;
    if (this.noticeClock <= 0) {
      this.noticeClock = NOTICE_SECONDS;
      this.notice();
    }
    this.shareClock -= seconds;
    if (this.shareClock <= 0) {
      this.shareClock = SHARE_SECONDS / 4;
      this.share();
    }
    for (let person = 0; person < this.people.count; person += 1) {
      if (this.people.pulse[person]! > 0) this.people.pulse[person] = Math.max(0, this.people.pulse[person]! - seconds);
    }
  }

  private notice(): void {
    const { people } = this;
    const { items, grid } = people.world;
    for (let person = 0; person < people.count; person += 1) {
      const held = people.heldItemType[person]!;
      this.meet(person, held as ItemType);
      const x = people.posX[person]!;
      const y = people.posY[person]!;
      for (let slot = 0; slot < items.used; slot += 1) {
        const kind = items.kind[slot]!;
        if (kind === ItemType.None || this.level(person, this.thingOf(kind as ItemType)) >= Known) continue;
        const at = grid.centre(items.tile[slot]!);
        if (Math.hypot(at.x - x, at.y - y) <= NOTICE_TILES) this.meet(person, kind as ItemType);
      }
    }
  }

  private thingOf(kind: ItemType): number {
    if (kind === ItemType.HandAxe) return neuronIndex('sharp');
    if (kind === ItemType.BurningBranch) return neuronIndex('flame');
    if (kind === ItemType.Cord) return neuronIndex('cord');
    if (kind === ItemType.Basket) return neuronIndex('basket');
    if (kind === ItemType.Roast) return neuronIndex('cooked');
    if (kind === ItemType.Fish) return neuronIndex('fish');
    if (kind === ItemType.Rabbit) return neuronIndex('rabbit');
    return NEURONS.findIndex((neuron) => neuron.item === kind);
  }

  private meet(person: number, kind: ItemType): void {
    if (kind === ItemType.None) return;
    const neuron = this.thingOf(kind);
    if (neuron >= 0) this.learn(person, neuron, Known);
  }

  private share(): void {
    const { people } = this;
    const { world } = people;
    for (let first = 0; first < people.count; first += 1) {
      for (let second = first + 1; second < people.count; second += 1) {
        if (this.away(first, second) > SHARE_TILES) continue;
        const centre = { x: (people.posX[first]! + people.posX[second]!) / 2, y: (people.posY[first]! + people.posY[second]!) / 2 };
        let bonus = 1;
        for (const tile of world.fires) {
          const at = world.grid.centre(tile);
          if (Math.hypot(at.x - centre.x, at.y - centre.y) <= SHARE_TILES * 2) bonus = FIRE_SHARE_BONUS;
        }
        const chance = Math.min(1, (SHARE_SECONDS / 4 / SHARE_SECONDS) * bonus);
        for (let neuron = 0; neuron < NEURON_COUNT; neuron += 1) {
          const one = this.level(first, neuron);
          const other = this.level(second, neuron);
          if (one >= Known && other === 0 && this.chance(first, second, neuron) < chance) this.learn(second, neuron, Heard);
          else if (other >= Known && one === 0 && this.chance(second, first, neuron) < chance) this.learn(first, neuron, Heard);
        }
      }
    }
  }

  private chance(from: number, to: number, neuron: number): number {
    const mix = Math.imul(from * 31 + to * 17 + neuron * 7 + 1, 2654435761) ^ Math.imul(Math.floor(this.now * 4) + 1, 40503);
    return ((mix >>> 0) % 1000) / 1000;
  }

  private place(): void {
    const { spots } = this;
    spots.clear();
    NEURONS.forEach((neuron, index) => spots.set(index, { x: neuron.angle, y: neuron.ring }));
    const taken: { x: number; y: number }[] = [];
    for (let index = 0; index < NEURON_COUNT; index += 1) if (this.seen(index)) taken.push(polar(NEURONS[index]!.angle, NEURONS[index]!.ring));
    for (const hypothesis of this.hypotheses) {
      if (hypothesis.order) continue;
      const key = -1 - hypothesis.id;
      if ((hypothesis.state === State.Success || hypothesis.state === State.Weak) && hypothesis.result >= 0) {
        spots.set(key, spots.get(hypothesis.result)!);
        continue;
      }
      const known = recipeFor(hypothesis.a, hypothesis.b);
      const home = known ? neuronIndex(known.result) : -1;
      if (home >= 0 && !this.seen(home)) {
        spots.set(key, spots.get(home)!);
        taken.push(polar(NEURONS[home]!.angle, NEURONS[home]!.ring));
        continue;
      }
      const one = spots.get(hypothesis.a)!;
      const two = spots.get(hypothesis.b)!;
      const mean = Math.atan2(Math.sin((one.x * Math.PI) / 180) + Math.sin((two.x * Math.PI) / 180), Math.cos((one.x * Math.PI) / 180) + Math.cos((two.x * Math.PI) / 180));
      let angle = ((mean * 180) / Math.PI + 360) % 360;
      const ring = Math.min(MAX_RING, Math.max(one.y, two.y) + 1);
      for (let step = 0; step < 12; step += 1) {
        const at = polar(angle, ring);
        if (!taken.some((other) => Math.hypot(other.x - at.x, other.y - at.y) < 34)) break;
        angle = (angle + (step % 2 === 0 ? 1 : -1) * (step + 1) * 9 + 360) % 360;
      }
      taken.push(polar(angle, ring));
      spots.set(key, { x: angle, y: ring });
    }
  }

  private seen(neuron: number): boolean {
    for (let person = 0; person < this.people.count; person += 1) if (this.level(person, neuron) > 0) return true;
    return false;
  }

  view(): MindView {
    this.place();
    const neurons: NeuronView[] = [];
    for (let index = 0; index < NEURON_COUNT; index += 1) {
      const spot = this.spots.get(index);
      const holders: number[] = [];
      for (let person = 0; person < this.people.count; person += 1) holders.push(this.level(person, index));
      if (!spot || holders.every((level) => level === 0)) continue;
      neurons.push({ index, x: spot.x, y: spot.y, holders, proven: holders.some((level) => level >= Known) });
    }
    const hypotheses: HypothesisView[] = [];
    for (const hypothesis of this.hypotheses) {
      if (hypothesis.state === State.Scar && (hypothesis.age ?? 0) >= DEAD_SECONDS) continue;
      const spot = this.spots.get(-1 - hypothesis.id) ?? { x: 0, y: 1 };
      hypotheses.push({
        id: hypothesis.id,
        a: hypothesis.a,
        b: hypothesis.b,
        state: hypothesis.state,
        result: hypothesis.result,
        x: spot.x,
        y: spot.y,
        tryer: hypothesis.tryer,
        partner: hypothesis.partner,
        order: hypothesis.order,
        note: hypothesis.note,
        age: hypothesis.age ?? 0,
      });
    }
    return { revision: this.revision, learned: this.learned, people: this.people.count, neurons, hypotheses, proven: this.achieved() };
  }

  snapshot(): MindState {
    return { known: Array.from(this.known), hypotheses: this.hypotheses.map((hypothesis) => ({ ...hypothesis })), next: this.next };
  }

  restore(saved: MindState): void {
    if (saved.known.length === this.known.length) this.known.set(saved.known);
    this.hypotheses.length = 0;
    for (const hypothesis of saved.hypotheses) this.hypotheses.push({ ...hypothesis, tryer: -1, partner: -1, retryAt: 0 });
    this.next = saved.next;
    this.revision += 1;
  }
}
