export const HomeKind = { Burrow: 0, Nest: 1, Anthill: 2, Termite: 3 } as const;

export type HomeKind = (typeof HomeKind)[keyof typeof HomeKind];

export const HOME_CAPACITY = 4096;

export const JOIN_RADIUS_METRES = 14;

export const BUILT_AT = 0.55;

export const FIELDS = 9;

export const PACKED_FIELDS = 10;

export const MAX_ENTRANCES = 8;

const STAGGER = 0.35;

const GOLDEN = 2.39996;

const hashOf = (a: number, b: number): number => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

export class Homes {
  readonly kind = new Uint8Array(HOME_CAPACITY);
  readonly owner = new Uint16Array(HOME_CAPACITY);
  readonly x = new Float32Array(HOME_CAPACITY);
  readonly y = new Float32Array(HOME_CAPACITY);
  readonly started = new Float32Array(HOME_CAPACITY);
  readonly days = new Float32Array(HOME_CAPACITY);
  readonly entrances = new Uint8Array(HOME_CAPACITY);
  readonly grewAt = new Float32Array(HOME_CAPACITY);
  readonly grewFrom = new Uint8Array(HOME_CAPACITY);

  used = 0;
  revision = 0;

  private readonly live = new Uint8Array(HOME_CAPACITY);
  private readonly vacant: number[] = [];

  get count(): number {
    return this.used - this.vacant.length;
  }

  exists(id: number): boolean {
    return id >= 0 && id < this.used && this.live[id] === 1;
  }

  add(kind: HomeKind, owner: number, x: number, y: number, now: number, days: number, entrances = 1): number {
    const id = this.vacant.pop() ?? (this.used < HOME_CAPACITY ? this.used++ : -1);
    if (id < 0) return -1;
    this.live[id] = 1;
    this.kind[id] = kind;
    this.owner[id] = owner;
    this.x[id] = x;
    this.y[id] = y;
    this.started[id] = now;
    this.days[id] = days;
    this.entrances[id] = entrances;
    this.grewAt[id] = now;
    this.grewFrom[id] = entrances;
    this.revision += 1;
    return id;
  }

  remove(id: number): void {
    if (!this.exists(id)) return;
    this.live[id] = 0;
    this.vacant.push(id);
    this.revision += 1;
  }

  near(kind: HomeKind, owner: number, x: number, y: number, radius: number): number {
    let best = -1;
    let nearest = radius * radius;
    for (let id = 0; id < this.used; id += 1) {
      if (this.live[id] !== 1 || this.kind[id] !== kind || this.owner[id] !== owner) continue;
      const gap = (this.x[id]! - x) ** 2 + (this.y[id]! - y) ** 2;
      if (gap <= nearest) {
        nearest = gap;
        best = id;
      }
    }
    return best;
  }

  entranceAt(id: number, index: number): readonly [number, number] {
    const angle = index * GOLDEN + hashOf(id, index) * 0.7;
    const away = index === 0 ? 0.4 : 1.7 * Math.sqrt(index + 0.5) * (0.8 + 0.4 * hashOf(index, id));
    return [this.x[id]! + Math.cos(angle) * away, this.y[id]! + Math.sin(angle) * away];
  }

  entranceProgress(id: number, index: number, now: number): number {
    if (!this.exists(id)) return 0;
    const born = index < this.grewFrom[id]! ? this.started[id]! + index * STAGGER * this.days[id]! : this.grewAt[id]!;
    return Math.min(1, Math.max(0, (now - born) / Math.max(this.days[id]!, 1e-6)));
  }

  progress(id: number, now: number): number {
    return this.entranceProgress(id, 0, now);
  }

  isBuilt(id: number, now: number): boolean {
    return this.progress(id, now) >= BUILT_AT;
  }

  nearestBuilt(id: number, now: number, x: number, y: number): readonly [number, number] | null {
    let best: readonly [number, number] | null = null;
    let nearest = Infinity;
    for (let index = 0; index < this.entrances[id]!; index += 1) {
      if (this.entranceProgress(id, index, now) < BUILT_AT) continue;
      const at = this.entranceAt(id, index);
      const gap = (at[0] - x) ** 2 + (at[1] - y) ** 2;
      if (gap < nearest) {
        nearest = gap;
        best = at;
      }
    }
    return best;
  }

  settle(kind: HomeKind, owner: number, x: number, y: number, members: number, now: number, days: number): number {
    const wanted = Math.min(MAX_ENTRANCES, Math.max(1, Math.ceil(members / 2)));
    const home = this.near(kind, owner, x, y, JOIN_RADIUS_METRES);
    if (home >= 0) {
      if (this.entrances[home]! < wanted) {
        this.grewFrom[home] = this.entrances[home]!;
        this.grewAt[home] = now;
        this.entrances[home] = wanted;
        this.revision += 1;
      }
      return home;
    }
    return this.add(kind, owner, x, y, now, days, wanted);
  }

  pack(): number[] {
    const out: number[] = [];
    for (let id = 0; id < this.used; id += 1) {
      if (this.live[id] !== 1) continue;
      out.push(id, this.kind[id]!, this.owner[id]!, this.x[id]!, this.y[id]!, this.started[id]!, this.days[id]!, this.entrances[id]!, this.grewAt[id]!, this.grewFrom[id]!);
    }
    return out;
  }

  apply(list: readonly number[]): void {
    this.live.fill(0);
    this.vacant.length = 0;
    this.used = 0;
    for (let at = 0; at + PACKED_FIELDS <= list.length; at += PACKED_FIELDS) {
      const id = list[at]!;
      this.live[id] = 1;
      this.kind[id] = list[at + 1]!;
      this.owner[id] = list[at + 2]!;
      this.x[id] = list[at + 3]!;
      this.y[id] = list[at + 4]!;
      this.started[id] = list[at + 5]!;
      this.days[id] = list[at + 6]!;
      this.entrances[id] = list[at + 7]!;
      this.grewAt[id] = list[at + 8]!;
      this.grewFrom[id] = list[at + 9]!;
      this.used = Math.max(this.used, id + 1);
    }
    for (let id = 0; id < this.used; id += 1) if (this.live[id] !== 1) this.vacant.push(id);
  }

  state(): number[] {
    const out: number[] = [];
    for (let id = 0; id < this.used; id += 1) {
      if (this.live[id] !== 1) continue;
      out.push(this.kind[id]!, this.owner[id]!, this.x[id]!, this.y[id]!, this.started[id]!, this.days[id]!, this.entrances[id]!, this.grewAt[id]!, this.grewFrom[id]!);
    }
    return out;
  }

  restore(saved: readonly number[]): void {
    for (let at = 0; at + FIELDS <= saved.length; at += FIELDS) {
      const id = this.add(saved[at]! as HomeKind, saved[at + 1]!, saved[at + 2]!, saved[at + 3]!, saved[at + 4]!, saved[at + 5]!, saved[at + 6]!);
      if (id >= 0) {
        this.grewAt[id] = saved[at + 7]!;
        this.grewFrom[id] = saved[at + 8]!;
      }
    }
  }
}
