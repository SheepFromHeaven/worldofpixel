import { createHash } from 'node:crypto';
import { stageWorld, TERRAINS } from '../../src/labs/zoo/stage.ts';
import { neuronIndex, parentsOf } from '../../src/modules/mind/api.ts';
import type { Mind } from '../../src/modules/mind/api.ts';
import { CORE_MODULES } from '../../src/modules/index.ts';
import type { ItemType } from '../../src/modules/items/api.ts';
import type { People } from '../../src/modules/people/api.ts';
import type { OfferContext } from '../../src/sim/offers.ts';
import { Simulation } from '../../src/sim/simulation.ts';
import type { Command } from '../../src/sim/simulation.ts';
import { StageSim } from '../../src/sim/stageSim.ts';
import type { World } from '../../src/sim/world.ts';
import { slicesFor } from '../../src/ui/radialSlices.ts';
import type { Slice } from '../../src/ui/radialMenu.ts';

export interface Check {
  readonly label: string;
  readonly pass: boolean;
  readonly detail: string;
}

export interface Scenario {
  readonly name: string;
  readonly summary: string;
  readonly target?: boolean;
  start?(): Run;
  run(run: Run): void;
}

export interface Fixture {
  readonly humans: readonly (readonly [number, number])[];
  readonly items?: readonly (readonly [number, number, ItemType, number?])[];
}

interface Engine {
  readonly world: World;
  readonly people: People;
  readonly mind: Mind;
  readonly offers?: OfferContext;
  advance(seconds: number): void;
  apply(command: Command): void;
}

const STEP = 0.5;

const PICK_EVERY_SECONDS = 4;

const MIDDLE = 192;

export class Run {
  readonly checks: Check[] = [];
  private clock = 0;

  private constructor(readonly seed: number, private readonly engine: Engine) {}

  static game(seed: number): Run {
    const sim = new Simulation(seed, 'settle', null, null, CORE_MODULES);
    sim.advance(0.05);
    return new Run(seed, sim);
  }

  static stage(fixture: Fixture, seed = 5): Run {
    const world = stageWorld(TERRAINS[0]!, seed);
    const at = (dx: number, dy: number): number => world.grid.at(MIDDLE + dx, MIDDLE + dy);
    const humans = fixture.humans.map(([dx, dy]) => ({ at: world.grid.centre(at(dx, dy)), heading: 0 }));
    const sim = new StageSim(world, humans);
    for (const [dx, dy, kind, count = 1] of fixture.items ?? []) for (let i = 0; i < count; i += 1) world.items.add(at(dx, dy), kind);
    return new Run(seed, sim);
  }

  get world(): World {
    return this.engine.world;
  }

  get people(): People {
    return this.engine.people;
  }

  get mind(): Mind {
    return this.engine.mind;
  }

  get seconds(): number {
    return this.clock;
  }

  tile(dx: number, dy: number): number {
    return this.world.grid.at(MIDDLE + dx, MIDDLE + dy);
  }

  apply(command: Command): void {
    this.engine.apply(command);
  }

  slices(tile: number): Slice[] {
    const { offers } = this.engine;
    if (!offers) throw new Error('this scenario has no radial menu');
    return slicesFor(offers, { send: (command) => this.apply(command), inspect: () => undefined }, tile);
  }

  labels(tile: number): string[] {
    const flatten = (slices: readonly Slice[], trail: string): string[] => slices.flatMap((slice) => [`${trail}${slice.label}`, ...flatten(slice.children ?? [], `${trail}${slice.label} > `)]);
    return flatten(this.slices(tile), '');
  }

  choose(tile: number, ...path: string[]): boolean {
    let slices = this.slices(tile);
    let chosen: Slice | undefined;
    for (const label of path) {
      chosen = slices.find((slice) => slice.label === label);
      if (!chosen) return this.expect(`the menu offers ${path.join(' > ')}`, false);
      slices = chosen.children ?? [];
    }
    if (chosen!.reason !== null) return this.expect(`${path.join(' > ')} is allowed`, false, chosen!.reason);
    chosen!.run();
    return true;
  }

  expect(label: string, pass: boolean, detail = ''): boolean {
    this.checks.push({ label, pass, detail });
    return pass;
  }

  private tick(): void {
    this.engine.advance(STEP);
    this.clock += STEP;
  }

  advance(seconds: number): void {
    for (let spent = 0; spent < seconds; spent += STEP) this.tick();
  }

  until(label: string, done: () => boolean, limitSeconds: number, each: () => void = () => undefined): boolean {
    const start = this.clock;
    while (!done() && this.clock - start < limitSeconds) {
      each();
      this.tick();
    }
    return this.expect(label, done(), `${(this.clock - start).toFixed(0)}s of ${limitSeconds}s`);
  }

  pursue(goal: string): () => void {
    const { mind } = this;
    const target = neuronIndex(goal);
    let last = -Infinity;
    const step = (cell: number): number | null => {
      if (mind.known[cell]) return null;
      for (const parent of parentsOf(cell)) {
        if (mind.known[parent]) continue;
        const below = step(parent);
        if (below !== null) return below;
        if (parentsOf(parent).length === 0) return -1;
      }
      return mind.ripe().includes(cell) ? cell : -1;
    };
    return () => {
      if (this.clock - last < PICK_EVERY_SECONDS) return;
      last = this.clock;
      const cell = step(target);
      if (cell === null || cell < 0) return;
      for (const parent of parentsOf(cell)) if (mind.pick(parent) !== null) break;
    };
  }

  digest(): string {
    return createHash('sha256').update(JSON.stringify([this.world.snapshot(), this.people.snapshot()])).digest('hex').slice(0, 12);
  }
}
