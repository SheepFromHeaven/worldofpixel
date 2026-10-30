import type { TileIndex } from '../grid.ts';
import { NOWHERE } from '../grid.ts';
import { ITEM_NAMES, ItemType } from '../people/items.ts';
import type { People } from '../people/people.ts';
import { BODY_TEMP_COLD, EntityState } from '../people/people.ts';
import type { Chain } from './neurons.ts';
import { GOALS, Kind, NEURONS, NEURON_COUNT, chainOf, neuronIndex, parentsOf, recipeMaking } from './neurons.ts';

export const State = { Open: 0, Success: 1 } as const;

export type State = (typeof State)[keyof typeof State];

export const NOTICE_TILES = 7;

export const PULSE_SECONDS = 1.6;

export const MIN_CURIOUS = 0.12;

export const WITHER_COST = 0.2;

export const WEARY_RECOVERY = 0.012;

const NOTICE_SECONDS = 0.5;

const RETRY_SECONDS = 6;

const HUNGRY_LIMIT = 0.8;

const THIRSTY_LIMIT = 0.8;

const TIRED_LIMIT = 0.85;

export interface Hypothesis {
  id: number;
  result: number;
  parents: number[];
  state: State;
  tryer: number;
  order: boolean;
  tile: TileIndex;
  note: string;
  retryAt: number;
}

export interface Idea {
  attached: number[];
  withered: number[];
}

export interface Job {
  id: number;
  tile: TileIndex;
}

export interface MindState {
  known: number[];
  hypotheses: Hypothesis[];
  next: number;
  idea: [number[], number[]];
  weariness: number;
}

export interface NeuronView {
  index: number;
  order: number;
}

export interface IdeaView {
  attached: readonly number[];
  withered: readonly number[];
}

export interface HypothesisView {
  id: number;
  result: number;
  parents: readonly number[];
  state: State;
  tryer: number;
  order: boolean;
  note: string;
}

export interface MindView {
  revision: number;
  learned: number;
  neurons: readonly NeuronView[];
  idea: IdeaView;
  ripe: readonly number[];
  hypotheses: readonly HypothesisView[];
  proven: readonly string[];
  curious: boolean;
  weariness: number;
}

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

const countOf = (list: readonly number[], value: number): number => list.reduce((sum, entry) => sum + (entry === value ? 1 : 0), 0);

const within = (parents: readonly number[], part: readonly number[]): boolean => part.every((neuron) => countOf(part, neuron) <= countOf(parents, neuron));

export class Mind {
  readonly known: Uint16Array;
  readonly hypotheses: Hypothesis[] = [];
  readonly idea: Idea = { attached: [], withered: [] };
  revision = 0;
  learned = 0;
  weariness = 0;
  private next = 0;
  private now = 0;
  private noticeClock = 0;

  constructor(private readonly people: People) {
    this.known = new Uint16Array(NEURON_COUNT);
  }

  knows(neuron: number): boolean {
    return (this.known[neuron] ?? 0) > 0;
  }

  proven(id: string): boolean {
    if (id === 'found') return NEURONS.some((neuron, index) => neuron.kind === Kind.Thing && this.knows(index));
    return this.knows(neuronIndex(id));
  }

  learn(neuron: number, person = -1): boolean {
    if (neuron < 0 || neuron >= NEURON_COUNT || this.known[neuron]) return false;
    this.known[neuron] = this.learned + 1;
    this.idea.withered.length = 0;
    if (this.idea.attached.length > 0 && this.fitting(this.idea.attached).length === 0) this.idea.attached.length = 0;
    if (person >= 0) this.people.pulse[person] = PULSE_SECONDS;
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

  mindful(): boolean {
    for (let person = 0; person < this.people.count; person += 1) if (this.curiosity(person) > MIN_CURIOUS) return true;
    return false;
  }

  ripe(): number[] {
    const out: number[] = [];
    for (let result = 0; result < NEURON_COUNT; result += 1) {
      const parents = parentsOf(result);
      if (parents.length === 0 || this.knows(result) || !parents.every((parent) => this.knows(parent))) continue;
      if (this.hypotheses.some((hypothesis) => !hypothesis.order && hypothesis.result === result)) continue;
      out.push(result);
    }
    return out;
  }

  private fitting(part: readonly number[]): number[] {
    return this.ripe().filter((result) => within(parentsOf(result), part));
  }

  pick(parent: number): string | null {
    if (parent < 0 || parent >= NEURON_COUNT) return 'not a neuron';
    if (!this.knows(parent)) return 'nobody knows that';
    const { idea } = this;
    if (idea.withered.includes(parent)) return 'already withered';
    if (!this.mindful()) return 'nobody has the mind for it';
    const next = [...idea.attached, parent];
    const fitting = this.fitting(next);
    this.revision += 1;
    if (fitting.length === 0) {
      idea.withered.push(parent);
      this.weariness = clamp01(this.weariness + WITHER_COST);
      return 'withered';
    }
    const whole = fitting.find((result) => parentsOf(result).length === next.length);
    if (whole === undefined) {
      idea.attached.push(parent);
      return null;
    }
    this.begin(whole, parentsOf(whole));
    this.drop();
    return null;
  }

  drop(): void {
    this.idea.attached.length = 0;
    this.idea.withered.length = 0;
    this.revision += 1;
  }

  private begin(cell: number, parents: readonly number[]): void {
    if (this.hypotheses.some((hypothesis) => !hypothesis.order && hypothesis.result === cell)) return;
    this.hypotheses.push({ id: this.next, result: cell, parents: [...parents], state: State.Open, tryer: -1, order: false, tile: NOWHERE, note: 'waiting', retryAt: 0 });
    this.next += 1;
  }

  order(result: number, tile: TileIndex): string | null {
    const recipe = recipeMaking(result);
    if (!recipe || recipe.order === undefined || !this.knows(result)) return 'nobody knows how';
    const { structures } = this.people.world;
    if (recipe.station && structures.stationAt(tile) !== recipe.station) return `needs a ${recipe.station}`;
    const working = this.hypotheses.filter((hypothesis) => hypothesis.order && hypothesis.state === State.Open && hypothesis.tile === tile).length;
    if (working >= (structures.jobSlots(tile) || 1)) return recipe.station ? 'every place is taken' : 'already being made';
    this.hypotheses.push({ id: this.next, result, parents: parentsOf(result).slice(), state: State.Open, tryer: -1, order: true, tile, note: 'waiting', retryAt: 0 });
    this.next += 1;
    this.revision += 1;
    return null;
  }

  cancel(id: number): void {
    const hypothesis = this.hypothesis(id);
    if (!hypothesis || !hypothesis.order || hypothesis.state !== State.Open || hypothesis.tryer >= 0) return;
    this.hypotheses.splice(this.hypotheses.indexOf(hypothesis), 1);
    this.revision += 1;
  }

  chainOf(hypothesis: Hypothesis): Chain {
    return chainOf(hypothesis.parents, recipeMaking(hypothesis.result));
  }

  supply(kind: ItemType, besides: TileIndex = NOWHERE): number {
    const { items } = this.people.world;
    const { floor, plan } = this.people.world.structures;
    let found = 0;
    for (let slot = 0; slot < items.used; slot += 1) {
      if (items.kind[slot] !== kind) continue;
      const tile = items.tile[slot]!;
      if (tile !== besides && (floor[tile] === 1 || plan[tile] !== 0)) continue;
      if (!this.people.world.movement.passable(tile)) continue;
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
    return this.people.curiosity[person]! * this.comfort(person) * (1 - this.weariness);
  }

  private free(person: number): boolean {
    const state = this.people.state[person]!;
    return (state === EntityState.Idle || state === EntityState.Wander) && this.people.wonder[person] === -1;
  }

  claim(person: number): Job | null {
    if (!this.free(person)) return null;
    for (const hypothesis of this.hypotheses) {
      if (hypothesis.state !== State.Open || hypothesis.tryer >= 0 || this.now < hypothesis.retryAt) continue;
      if (hypothesis.order) {
        if (!this.nearestTo(hypothesis.tile, person)) continue;
        if (this.shortOf(hypothesis) !== ItemType.None) {
          this.hold(hypothesis, 'needs material');
          continue;
        }
        return this.take(hypothesis, person);
      }
      if (this.curiosity(person) < MIN_CURIOUS) continue;
      if (this.mostCurious() !== person) continue;
      const short = this.shortOf(hypothesis);
      if (short !== ItemType.None) {
        this.hold(hypothesis, `no ${ITEM_NAMES[short] ?? 'item'} to try it with`);
        continue;
      }
      return this.take(hypothesis, person);
    }
    return null;
  }

  ready = false;

  eager(person: number): boolean {
    return this.curiosity(person) > MIN_CURIOUS;
  }

  private refreshReady(): void {
    this.ready = this.mindful() && this.hypotheses.some((hypothesis) => hypothesis.state === State.Open && hypothesis.tryer < 0 && this.now >= hypothesis.retryAt && this.shortOf(hypothesis) === ItemType.None);
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

  private mostCurious(): number {
    let best = -1;
    let most = MIN_CURIOUS;
    for (let person = 0; person < this.people.count; person += 1) {
      if (!this.free(person)) continue;
      const wish = this.curiosity(person);
      if (wish > most) {
        most = wish;
        best = person;
      }
    }
    return best;
  }

  private take(hypothesis: Hypothesis, person: number): Job {
    hypothesis.tryer = person;
    hypothesis.note = 'fetching';
    this.revision += 1;
    return { id: hypothesis.id, tile: hypothesis.order ? hypothesis.tile : NOWHERE };
  }

  say(hypothesis: Hypothesis, note: string): void {
    this.hold(hypothesis, note);
  }

  release(hypothesis: Hypothesis, note: string): void {
    hypothesis.tryer = -1;
    hypothesis.note = note;
    hypothesis.retryAt = this.now + RETRY_SECONDS;
    this.revision += 1;
  }

  resolve(hypothesis: Hypothesis, person: number): void {
    this.hypotheses.splice(this.hypotheses.indexOf(hypothesis), 1);
    this.revision += 1;
    if (hypothesis.order) return;
    for (const parent of hypothesis.parents) this.learn(parent, person);
    this.learn(hypothesis.result, person);
  }

  achieved(): readonly string[] {
    return GOALS.filter((goal) => this.proven(goal));
  }

  update(seconds: number): void {
    this.now += seconds;
    for (const hypothesis of this.hypotheses) {
      if (hypothesis.state === State.Open && hypothesis.tryer >= 0 && this.people.wonder[hypothesis.tryer] !== hypothesis.id) this.release(hypothesis, 'dropped, waiting');
    }
    const settled = this.hypotheses.findIndex((hypothesis) => !hypothesis.order && hypothesis.tryer < 0 && this.knows(hypothesis.result));
    if (settled >= 0) {
      this.hypotheses.splice(settled, 1);
      this.revision += 1;
    }
    if (this.weariness > 0) this.weariness = Math.max(0, this.weariness - WEARY_RECOVERY * this.groupComfort() * seconds);
    this.noticeClock -= seconds;
    if (this.noticeClock <= 0) {
      this.noticeClock = NOTICE_SECONDS;
      this.notice();
      this.refreshReady();
    }
    for (let person = 0; person < this.people.count; person += 1) {
      if (this.people.pulse[person]! > 0) this.people.pulse[person] = Math.max(0, this.people.pulse[person]! - seconds);
    }
  }

  private groupComfort(): number {
    if (this.people.count === 0) return 1;
    let sum = 0;
    for (let person = 0; person < this.people.count; person += 1) sum += this.comfort(person);
    return sum / this.people.count;
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
        if (kind === ItemType.None || this.knows(this.thingOf(kind as ItemType))) continue;
        const at = grid.centre(items.tile[slot]!);
        if (Math.hypot(at.x - x, at.y - y) <= NOTICE_TILES) this.meet(person, kind as ItemType);
      }
    }
  }

  private thingOf(kind: ItemType): number {
    if (kind === ItemType.HandAxe) return neuronIndex('sharp');
    if (kind === ItemType.BurningBranch) return neuronIndex('flame');
    return NEURONS.findIndex((neuron) => neuron.item === kind);
  }

  private meet(person: number, kind: ItemType): void {
    if (kind === ItemType.None) return;
    const neuron = this.thingOf(kind);
    if (neuron >= 0) this.learn(neuron, person);
  }

  view(): MindView {
    const neurons: NeuronView[] = [];
    for (let index = 0; index < NEURON_COUNT; index += 1) if (this.knows(index)) neurons.push({ index, order: this.known[index] ?? 0 });
    const hypotheses: HypothesisView[] = this.hypotheses.map((hypothesis) => ({
      id: hypothesis.id,
      result: hypothesis.result,
      parents: hypothesis.parents.slice(),
      state: hypothesis.state,
      tryer: hypothesis.tryer,
      order: hypothesis.order,
      note: hypothesis.note,
    }));
    const idea = { attached: this.idea.attached.slice(), withered: this.idea.withered.slice() };
    return { revision: this.revision, learned: this.learned, neurons, idea, ripe: this.ripe(), hypotheses, proven: this.achieved(), curious: this.mindful(), weariness: this.weariness };
  }

  snapshot(): MindState {
    return {
      known: Array.from(this.known),
      hypotheses: this.hypotheses.map((hypothesis) => ({ ...hypothesis, parents: hypothesis.parents.slice() })),
      next: this.next,
      idea: [this.idea.attached.slice(), this.idea.withered.slice()],
      weariness: this.weariness,
    };
  }

  restore(saved: MindState): void {
    this.known.set(saved.known);
    this.learned = saved.known.reduce((most, order) => Math.max(most, order), 0);
    this.hypotheses.length = 0;
    for (const hypothesis of saved.hypotheses) this.hypotheses.push({ ...hypothesis, tryer: -1, retryAt: 0 });
    this.next = saved.next;
    this.idea.attached.splice(0, Infinity, ...saved.idea[0]);
    this.idea.withered.splice(0, Infinity, ...saved.idea[1]);
    this.weariness = saved.weariness;
    this.revision += 1;
  }
}
