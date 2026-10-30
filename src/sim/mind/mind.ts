import type { TileIndex } from '../grid.ts';
import { NOWHERE } from '../grid.ts';
import { ITEM_NAMES, ItemType } from '../people/items.ts';
import type { People } from '../people/people.ts';
import { BODY_TEMP_COLD, EntityState } from '../people/people.ts';
import type { Places } from './growth.ts';
import { grow } from './growth.ts';
import type { Chain } from './neurons.ts';
import { GOALS, NEURONS, NEURON_COUNT, chainOf, isRoot, neuronIndex, parentsOf, recipeMaking } from './neurons.ts';

export const State = { Open: 0, Success: 1 } as const;

export type State = (typeof State)[keyof typeof State];

export const Step = { Hidden: 0, Glimmer: 1, Shape: 2, Heartbeat: 3 } as const;

export type Step = (typeof Step)[keyof typeof Step];

export const NOTICE_TILES = 7;

export const PULSE_SECONDS = 1.6;

export const MIN_CURIOUS = 0.12;

export const WITHER_COST = 0.2;

export const WEARY_RECOVERY = 0.012;

const NOTICE_SECONDS = 0.5;

const RETRY_SECONDS = 25;

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

export interface Cell {
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
  cells: [number, number[], number[]][];
  places: [number, number, number][];
  weariness: number;
}

export interface NeuronView {
  index: number;
  x: number;
  y: number;
}

export interface CellView {
  index: number;
  x: number;
  y: number;
  step: Step;
  sockets: number;
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
  cells: readonly CellView[];
  hypotheses: readonly HypothesisView[];
  proven: readonly string[];
  curious: boolean;
  weariness: number;
}

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

const countOf = (list: readonly number[], value: number): number => list.reduce((sum, entry) => sum + (entry === value ? 1 : 0), 0);

export function stepOf(cell: number, known: (neuron: number) => boolean): Step {
  if (isRoot(cell)) return Step.Hidden;
  const distinct = [...new Set(parentsOf(cell))];
  const held = distinct.filter(known).length;
  if (held === 0) return Step.Hidden;
  if (held === distinct.length) return Step.Heartbeat;
  return held === 1 ? Step.Glimmer : Step.Shape;
}

export class Mind {
  readonly known: Uint8Array;
  readonly hypotheses: Hypothesis[] = [];
  readonly cells = new Map<number, Cell>();
  readonly places: Places = new Map();
  revision = 0;
  learned = 0;
  weariness = 0;
  private next = 0;
  private now = 0;
  private noticeClock = 0;
  private grownAt = -1;

  constructor(private readonly people: People) {
    this.known = new Uint8Array(NEURON_COUNT);
  }

  knows(neuron: number): boolean {
    return (this.known[neuron] ?? 0) > 0;
  }

  proven(id: string): boolean {
    return this.knows(neuronIndex(id));
  }

  learn(neuron: number, person = -1): boolean {
    if (neuron < 0 || neuron >= NEURON_COUNT || this.known[neuron]) return false;
    this.known[neuron] = 1;
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

  stepOf(cell: number): Step {
    if (this.knows(cell)) return Step.Hidden;
    return stepOf(cell, (neuron) => this.knows(neuron));
  }

  cellOf(cell: number): Cell {
    let found = this.cells.get(cell);
    if (!found) {
      found = { attached: [], withered: [] };
      this.cells.set(cell, found);
    }
    return found;
  }

  mindful(): boolean {
    for (let person = 0; person < this.people.count; person += 1) if (this.curiosity(person) > MIN_CURIOUS) return true;
    return false;
  }

  attach(cell: number, parent: number): string | null {
    if (cell < 0 || cell >= NEURON_COUNT || parent < 0 || parent >= NEURON_COUNT) return 'not a neuron';
    const parents = parentsOf(cell);
    if (parents.length === 0) return 'not a cell';
    if (this.knows(cell)) return 'already known';
    if (this.stepOf(cell) === Step.Hidden) return 'nothing there yet';
    if (!this.knows(parent)) return 'nobody knows that';
    const state = this.cellOf(cell);
    if (state.withered.includes(parent)) return 'already withered there';
    if (state.attached.length >= parents.length) return 'already whole';
    if (!this.mindful()) return 'nobody has the mind for it';
    const wanted = countOf(parents, parent);
    if (wanted > 0 && countOf(state.attached, parent) >= wanted) return 'already attached';
    if (wanted > 0) {
      state.attached.push(parent);
      if (state.attached.length === parents.length) this.begin(cell, parents);
    } else {
      state.withered.push(parent);
      this.weariness = clamp01(this.weariness + WITHER_COST);
    }
    this.revision += 1;
    return wanted > 0 ? null : 'withered';
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
    }
    for (let person = 0; person < this.people.count; person += 1) {
      if (this.people.pulse[person]! > 0) this.people.pulse[person] = Math.max(0, this.people.pulse[person]! - seconds);
    }
    this.grow();
  }

  private groupComfort(): number {
    if (this.people.count === 0) return 1;
    let sum = 0;
    for (let person = 0; person < this.people.count; person += 1) sum += this.comfort(person);
    return sum / this.people.count;
  }

  grow(): void {
    if (this.grownAt === this.revision) return;
    if (grow(this.places, (neuron) => this.knows(neuron) || this.stepOf(neuron) !== Step.Hidden, this.people.world.seed)) this.revision += 1;
    this.grownAt = this.revision;
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
    this.grow();
    const neurons: NeuronView[] = [];
    const cells: CellView[] = [];
    for (let index = 0; index < NEURON_COUNT; index += 1) {
      const place = this.places.get(index);
      if (!place) continue;
      const step = this.stepOf(index);
      if (step !== Step.Hidden) {
        const cell = this.cells.get(index);
        cells.push({ index, x: place.x, y: place.y, step, sockets: parentsOf(index).length, attached: cell?.attached.slice() ?? [], withered: cell?.withered.slice() ?? [] });
        continue;
      }
      if (this.knows(index)) neurons.push({ index, x: place.x, y: place.y });
    }
    const hypotheses: HypothesisView[] = this.hypotheses.map((hypothesis) => ({
      id: hypothesis.id,
      result: hypothesis.result,
      parents: hypothesis.parents.slice(),
      state: hypothesis.state,
      tryer: hypothesis.tryer,
      order: hypothesis.order,
      note: hypothesis.note,
    }));
    return { revision: this.revision, learned: this.learned, neurons, cells, hypotheses, proven: this.achieved(), curious: this.mindful(), weariness: this.weariness };
  }

  snapshot(): MindState {
    return {
      known: Array.from(this.known),
      hypotheses: this.hypotheses.map((hypothesis) => ({ ...hypothesis, parents: hypothesis.parents.slice() })),
      next: this.next,
      cells: [...this.cells].map(([index, cell]) => [index, cell.attached.slice(), cell.withered.slice()]),
      places: [...this.places].map(([index, place]) => [index, place.x, place.y]),
      weariness: this.weariness,
    };
  }

  restore(saved: MindState): void {
    this.known.set(saved.known);
    this.hypotheses.length = 0;
    for (const hypothesis of saved.hypotheses) this.hypotheses.push({ ...hypothesis, tryer: -1, retryAt: 0 });
    this.next = saved.next;
    this.cells.clear();
    for (const [index, attached, withered] of saved.cells) this.cells.set(index, { attached: [...attached], withered: [...withered] });
    this.places.clear();
    for (const [index, x, y] of saved.places) this.places.set(index, { x, y });
    this.weariness = saved.weariness;
    this.revision += 1;
  }
}
