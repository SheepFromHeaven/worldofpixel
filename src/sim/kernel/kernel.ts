export interface Capability<T> {
  readonly id: string;
  readonly kind?: T;
}

export const capability = <T>(id: string): Capability<T> => ({ id });

type Needs = Readonly<Record<string, Capability<unknown>>>;

type Resolved<N extends Needs> = { readonly [K in keyof N]: N[K] extends Capability<infer T> ? T : never };

export interface Provision<T = unknown> {
  readonly token: Capability<T>;
  readonly value: T;
}

export const provide = <T>(token: Capability<T>, value: T): Provision<T> => ({ token, value });

export interface Tick {
  seconds: number;
  scaled: number;
}

export type Handler = (args: never, kernel: Kernel) => unknown;

export interface Running {
  readonly provides?: readonly Provision[];
  readonly commands?: Readonly<Record<string, Handler>>;
  start?(kernel: Kernel): void;
  save?(): Readonly<Record<string, unknown>>;
  update?(tick: Tick): void;
}

export interface System {
  readonly id: string;
  readonly needs: Needs;
  readonly tags?: readonly string[];
  create(deps: never): Running;
}

export function system<N extends Needs>(definition: {
  readonly id: string;
  readonly needs: N;
  readonly tags?: readonly string[];
  create(deps: Resolved<N>): Running;
}): System {
  return definition as unknown as System;
}

export class Kernel {
  private readonly provided = new Map<string, unknown>();
  private readonly running: { readonly id: string; readonly tags: readonly string[]; readonly update: (tick: Tick) => void }[] = [];
  private readonly starts: ((kernel: Kernel) => void)[] = [];
  private readonly saves: (() => Readonly<Record<string, unknown>>)[] = [];
  private readonly commands = new Map<string, Handler>();
  readonly order: string[] = [];

  constructor(systems: readonly System[], seeds: readonly Provision[] = []) {
    for (const { token, value } of seeds) this.offer(token.id, value, 'seed');
    const pending = [...systems];
    const rank = new Map(systems.map((one, index) => [one.id, index]));
    while (pending.length > 0) {
      const next = pending.findIndex((candidate) => Object.values(candidate.needs).every((token) => this.provided.has(token.id)));
      if (next < 0) throw new Error(`unresolved needs: ${pending.map((s) => `${s.id} wants ${Object.values(s.needs).filter((t) => !this.provided.has(t.id)).map((t) => t.id).join('+')}`).join('; ')}`);
      const [chosen] = pending.splice(next, 1) as [System];
      const deps = Object.fromEntries(Object.entries(chosen.needs).map(([name, token]) => [name, this.provided.get(token.id)]));
      const running = chosen.create(deps as never);
      for (const { token, value } of running.provides ?? []) this.offer(token.id, value, chosen.id);
      if (running.update) this.running.push({ id: chosen.id, tags: chosen.tags ?? [], update: running.update.bind(running) });
      for (const [name, handler] of Object.entries(running.commands ?? {})) {
        if (this.commands.has(name)) throw new Error(`command ${name} is registered twice (again by ${chosen.id})`);
        this.commands.set(name, handler);
      }
      if (running.start) this.starts.push(running.start.bind(running));
      if (running.save) this.saves.push(running.save.bind(running));
      this.order.push(chosen.id);
    }
    this.running.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
    for (const start of this.starts) start(this);
  }

  get<T>(token: Capability<T>): T {
    if (!this.provided.has(token.id)) throw new Error(`nothing provides ${token.id}`);
    return this.provided.get(token.id) as T;
  }

  snapshot(): Record<string, unknown> {
    return Object.assign({}, ...this.saves.map((save) => save()));
  }

  find<T>(token: Capability<T>): T | undefined {
    return this.provided.get(token.id) as T | undefined;
  }

  has(command: string): boolean {
    return this.commands.has(command);
  }

  run(command: string, args: unknown = {}): unknown {
    const handler = this.commands.get(command);
    if (!handler) throw new Error(`no module registers the command ${command}`);
    return handler(args as never, this);
  }

  update(tick: Tick, tag?: string): void {
    for (const { tags, update } of this.running) if (tag === undefined || tags.includes(tag)) update(tick);
  }

  private offer(id: string, value: unknown, by: string): void {
    if (this.provided.has(id)) throw new Error(`${id} is provided twice (again by ${by})`);
    this.provided.set(id, value);
  }
}
