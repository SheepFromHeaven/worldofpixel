import { createHash } from 'node:crypto';
import { neuronIndex, parentsOf } from '../../src/modules/mind/api.ts';
import { CORE_MODULES } from '../../src/modules/index.ts';
import { Simulation } from '../../src/sim/simulation.ts';

export interface Check {
  readonly label: string;
  readonly pass: boolean;
  readonly detail: string;
}

export interface Scenario {
  readonly name: string;
  readonly summary: string;
  readonly target?: boolean;
  run(run: Run): void;
}

const STEP = 0.5;

const PICK_EVERY_SECONDS = 4;

export class Run {
  readonly sim: Simulation;
  readonly checks: Check[] = [];

  constructor(readonly seed: number, mode: 'settle' | 'discover' = 'settle') {
    this.sim = new Simulation(seed, mode, null, null, CORE_MODULES);
    this.sim.advance(0.05);
  }

  get seconds(): number {
    return this.sim.playTime;
  }

  expect(label: string, pass: boolean, detail = ''): boolean {
    this.checks.push({ label, pass, detail });
    return pass;
  }

  advance(seconds: number): void {
    for (let spent = 0; spent < seconds; spent += STEP) this.sim.advance(STEP);
  }

  until(label: string, done: () => boolean, limitSeconds: number, each: () => void = () => undefined): boolean {
    const start = this.seconds;
    while (!done() && this.seconds - start < limitSeconds) {
      each();
      this.sim.advance(STEP);
    }
    const reached = done();
    return this.expect(label, reached, `${(this.seconds - start).toFixed(0)}s of ${limitSeconds}s`);
  }

  pursue(goal: string): () => void {
    const { mind } = this.sim;
    const target = neuronIndex(goal);
    let last = -Infinity;
    const step = (cell: number): number | null => {
      if (mind.known[cell]) return null;
      const parents = parentsOf(cell);
      for (const parent of parents) {
        if (mind.known[parent]) continue;
        const below = step(parent);
        if (below !== null) return below;
        if (parentsOf(parent).length === 0) return -1;
      }
      return mind.ripe().includes(cell) ? cell : -1;
    };
    return () => {
      if (this.seconds - last < PICK_EVERY_SECONDS) return;
      last = this.seconds;
      const cell = step(target);
      if (cell === null || cell < 0) return;
      for (const parent of parentsOf(cell)) if (mind.pick(parent) !== null) break;
    };
  }

  digest(): string {
    return createHash('sha256').update(JSON.stringify(this.sim.snapshot())).digest('hex').slice(0, 12);
  }
}
