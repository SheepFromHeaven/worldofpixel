import { behaviourOf, poseFor } from '../animals/catalogue.ts';
import { MAMMALS } from '../sim/mammals/species.ts';
import { stateIndexOf, statesOf } from '../animals/types.ts';
import type { Camera } from '../render/camera.ts';
import type { ZooState } from '../render/lit/zoo.ts';
import { FACING_RADIANS_PER_SECOND, GLANCE_FROM_METRES, GLANCE_PER_SECOND, turnToward, Walker } from '../sim/animals/walker.ts';
import { AGENT_FLOATS, packAgent } from '../render/lit/mammalAgents.ts';
import type { MammalAgents } from '../render/lit/mammalAgents.ts';
import type { HumanDraw } from '../render/lit/humanPass.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { prng } from '../sim/rng.ts';
import type { World } from '../sim/world.ts';
import type { ZooEntry } from './catalogue.ts';
import type { HomeHabit } from '../animals/types.ts';
import { JOIN_RADIUS_METRES } from '../sim/homes/homes.ts';
import type { HomeKind } from '../sim/homes/homes.ts';
import { findSpots, suitabilityAt } from './spot.ts';

const FOLLOW_RATE = 4;

const FOLLOW_LOCK_METRES = 3;

const STARTLE_FACTOR = 1.6;

const STARTLE_PACE = 2.4;

const STARTLE_TRIES = 5;

const DEFAULT_ZOOM = 64;

const STEP_METRES = 0.5;

const LIMIT = 200;

const HOME_CHECK_SECONDS = 0.5;

const COMPANY_METRES = 8;

const MIN_COMPANY = 2;

const ZOO_DAY_SECONDS = 30;

const MIN_BODY_METRES = 0.4;

export interface ZooReadout {
  name: string;
  group: string;
  position: Vec2;
  travelling: boolean;
  remaining: number;
  suitability: number;
  speed: number;
  count: number;
  key: string;
}

export interface Placement {
  entry: ZooEntry;
  at: Vec2;
}

class Actor {
  state: ZooState;
  target: Vec2 | null = null;
  seen: Vec2 | null = null;
  private readonly walker: Walker;
  private facing: Vec2 = { x: 1, y: 0 };
  private glance = 0;
  private den: Vec2;
  private readonly origin: Vec2;
  readonly dwelling: HomeHabit | undefined;
  private readonly random;
  private hide: { from: number; until: number } | null = null;

  constructor(
    private readonly world: World,
    readonly entry: ZooEntry,
    at: Vec2,
    clock: number,
    serial: number,
  ) {
    this.den = at;
    this.origin = at;
    this.dwelling = entry.group === 'mammal' ? behaviourOf(entry.key)?.home : undefined;
    this.random = prng(entry.life + 1 + serial * 977);
    this.walker = new Walker(at, entry, (from, to) => this.clear(from, to), prng(entry.life + 1 + serial * 977), clock);
    this.state = { group: entry.group, species: entry.index, home: at, cell: at, legs: [] };
  }

  shelter(at: Vec2 | null): void {
    this.den = at ?? this.origin;
  }

  radius(): number {
    return Math.max(MIN_BODY_METRES, this.entry.length * 0.5);
  }

  tick(clock: number, seconds: number): void {
    const { entry, walker } = this;
    if (entry.roams) {
      walker.update(clock);
      this.publish();
    }
    const pose = walker.pose(clock);
    const wanted = entry.group === 'mammal' && entry.length >= GLANCE_FROM_METRES ? walker.glance(clock) : 0;
    this.glance += (wanted - this.glance) * (1 - Math.exp(-GLANCE_PER_SECOND * seconds));
    this.facing = pose.going || entry.roams ? turnToward(this.facing, pose.dir, FACING_RADIANS_PER_SECOND * seconds) : this.facing;
  }

  pose(time: number): { pos: Vec2; going: boolean } {
    return this.walker.pose(time);
  }

  send(point: Vec2, time: number): string | null {
    const { entry, walker } = this;
    const here = walker.pose(time).pos;
    const drawn = entry.roams ? here : (this.seen ?? here);
    const aim = { x: point.x - (drawn.x - here.x), y: point.y - (drawn.y - here.y) };
    const pace = behaviourOf(entry.key)?.hooks.command?.({ distance: Math.hypot(aim.x - here.x, aim.y - here.y) }) ?? 1;
    if (!walker.sendTo(aim, time, pace)) return `${entry.name} cannot go there, the ground in between is not its own`;
    this.hide = null;
    this.target = point;
    this.publish();
    return null;
  }

  startle(point: Vec2, time: number): void {
    const { entry, walker } = this;
    if (entry.group !== 'mammal') return;
    const species = MAMMALS[entry.index]!;
    if (species.skit <= 0) return;
    const here = walker.pose(time).pos;
    if (Math.hypot(here.x - point.x, here.y - point.y) > species.skit) return;
    const reaction = behaviourOf(entry.key)?.hooks.flee?.({ here, from: point, den: this.den, skit: species.skit, random: this.random });
    const pace = reaction ? reaction.pace : STARTLE_PACE;
    if (reaction?.target && walker.sendTo(reaction.target, time, pace)) {
      if (reaction.hide) {
        const from = walker.endsAt(time);
        this.hide = { from, until: from + reaction.hide };
        walker.holdUntil(this.hide.until);
      }
      this.target = reaction.target;
      this.publish();
      return;
    }
    this.hide = null;
    const distance = reaction ? reaction.distance : species.skit * STARTLE_FACTOR;
    const away = Math.atan2(here.y - point.y, here.x - point.x);
    for (let attempt = 0; attempt < STARTLE_TRIES; attempt += 1) {
      const angle = away + (attempt === 0 ? 0 : (this.random() - 0.5) * 2.2);
      const target = { x: here.x + Math.cos(angle) * distance, y: here.y + Math.sin(angle) * distance };
      if (!walker.sendTo(target, time, pace)) continue;
      this.target = target;
      this.publish();
      return;
    }
  }

  readout(time: number, count: number): ZooReadout {
    const { entry, walker } = this;
    const pose = walker.pose(time);
    return {
      name: entry.name,
      group: entry.group,
      position: pose.pos,
      travelling: pose.going,
      remaining: walker.remaining(time),
      suitability: suitabilityAt(this.world, entry, pose.pos),
      speed: walker.speed(),
      count,
      key: entry.key,
    };
  }

  pack(data: Float32Array, index: number, time: number): void {
    const { entry, walker } = this;
    const pose = walker.pose(time);
    if (this.hide && time >= this.hide.until) this.hide = null;
    const behaviour = behaviourOf(entry.key);
    const burrowing = this.hide && time >= this.hide.from ? statesOf(behaviour).indexOf('burrow') : -1;
    const state = burrowing >= 0 ? burrowing : pose.going ? stateIndexOf(behaviour, pose) : 0;
    const since = burrowing >= 0 ? time - this.hide!.from : 0;
    const left = burrowing >= 0 ? this.hide!.until - time : 0;
    packAgent(data, index, {
      x: pose.pos.x,
      y: pose.pos.y,
      dirX: this.facing.x,
      dirY: this.facing.y,
      species: entry.index,
      stage: 2,
      key: ((entry.life * 0.6180339887) % 1 + 1) % 1,
      travelled: walker.distance(time),
      going: pose.going ? 1 : 0,
      groupKey: ((entry.life * 0.7548776662) % 1 + 1) % 1,
      member: 0,
      denX: this.den.x,
      denY: this.den.y,
      glance: this.glance,
      state,
      pose: poseFor(entry.key, state, MAMMALS[entry.index]!.length, MAMMALS[entry.index]!.legs, walker.distance(time), pose.going, since, left),
    });
  }

  heading(): number {
    return Math.atan2(this.facing.y, this.facing.x);
  }

  human(time: number): HumanDraw {
    const pose = this.walker.pose(time);
    return { x: pose.pos.x, y: pose.pos.y, heading: Math.atan2(this.facing.y, this.facing.x), stride: this.walker.distance(time), moving: pose.going, who: 0 };
  }

  private publish(): void {
    const { walker, state } = this;
    this.state = { ...state, home: walker.home, travelled: walker.travelled, legs: [...walker.legs] };
  }

  private clear(from: Vec2, to: Vec2): boolean {
    const { entry } = this;
    if (!entry.bound) return true;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(length / STEP_METRES));
    for (let step = 1; step <= steps; step += 1) {
      const u = step / steps;
      if (suitabilityAt(this.world, entry, { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u }) <= 0) return false;
    }
    return true;
  }
}

export class ZooSession {
  follow = true;
  camera: Camera = { centre: { x: 0, y: 0 }, zoom: DEFAULT_ZOOM };
  refused: string | null = null;
  paused = false;
  private clock = 0;
  private actors: Actor[] = [];
  private focused: Actor | null = null;
  private serial = 0;
  private readonly spotsFor = new Map<ZooEntry, Vec2[]>();
  private homeWait = 0;

  constructor(readonly world: World) {}

  now(): number {
    return this.clock;
  }

  get count(): number {
    return this.actors.length;
  }

  get entry(): ZooEntry | null {
    return this.focused?.entry ?? null;
  }

  get target(): Vec2 | null {
    return this.focused?.target ?? null;
  }

  get seen(): Vec2 | null {
    return this.focused?.seen ?? null;
  }

  set seen(point: Vec2 | null) {
    if (this.focused) this.focused.seen = point;
  }

  placements(): Placement[] {
    return this.actors.map((one) => ({ entry: one.entry, at: one.state.cell }));
  }

  homeTime(): number {
    return this.clock / ZOO_DAY_SECONDS;
  }

  tick(seconds: number): void {
    if (this.paused) return;
    this.clock += seconds;
    for (const one of this.actors) one.tick(this.clock, seconds);
    this.homeWait -= seconds;
    if (this.homeWait <= 0) {
      this.homeWait = HOME_CHECK_SECONDS;
      this.refreshHomes();
    }
  }

  private refreshHomes(): void {
    const { homes } = this.world;
    const time = this.clock;
    const days = this.homeTime();
    const dwellers = this.actors.filter((one) => one.dwelling);
    const where = new Map<Actor, Vec2>(dwellers.map((one) => [one, one.pose(time).pos]));
    const placed = new Set<number>();
    const grouped = new Set<Actor>();
    for (const first of dwellers) {
      if (grouped.has(first)) continue;
      const company = [first];
      grouped.add(first);
      for (let at = 0; at < company.length; at += 1) {
        const here = where.get(company[at]!)!;
        for (const other of dwellers) {
          if (grouped.has(other) || other.entry.index !== first.entry.index) continue;
          const there = where.get(other)!;
          if (Math.hypot(there.x - here.x, there.y - here.y) > COMPANY_METRES) continue;
          grouped.add(other);
          company.push(other);
        }
      }
      if (company.length < MIN_COMPANY) continue;
      const x = company.reduce((sum, one) => sum + where.get(one)!.x, 0) / company.length;
      const y = company.reduce((sum, one) => sum + where.get(one)!.y, 0) / company.length;
      const id = homes.settle(first.dwelling!.kind as HomeKind, first.entry.index, x, y, company.length, days, first.dwelling!.days);
      if (id >= 0) placed.add(id);
    }
    for (let id = 0; id < homes.used; id += 1) {
      if (!homes.exists(id) || placed.has(id)) continue;
      const attended = dwellers.some((one) => {
        const there = where.get(one)!;
        return one.entry.index === homes.owner[id] && Math.hypot(there.x - homes.x[id]!, there.y - homes.y[id]!) <= JOIN_RADIUS_METRES * 2;
      });
      if (!attended) homes.remove(id);
    }
    for (const one of dwellers) {
      const there = where.get(one)!;
      const id = homes.near(one.dwelling!.kind as HomeKind, one.entry.index, there.x, there.y, JOIN_RADIUS_METRES * 2);
      const entrance = id >= 0 ? homes.nearestBuilt(id, days, there.x, there.y) : null;
      one.shelter(entrance ? { x: entrance[0], y: entrance[1] } : null);
    }
  }

  habitat(entry: ZooEntry): Vec2 | null {
    let spots = this.spotsFor.get(entry);
    if (!spots) {
      spots = findSpots(this.world, entry);
      this.spotsFor.set(entry, spots);
    }
    return spots[0] ?? null;
  }

  add(entry: ZooEntry, at: Vec2, force = false): boolean {
    if (this.actors.length >= LIMIT) {
      this.refused = `the zoo holds at most ${LIMIT} animals`;
      return false;
    }
    if (!force && entry.bound && suitabilityAt(this.world, entry, at) <= 0) {
      this.refused = `${entry.name} cannot live there`;
      return false;
    }
    this.refused = null;
    const one = new Actor(this.world, entry, at, this.clock, this.serial);
    this.serial += 1;
    this.actors.push(one);
    this.focused = one;
    return true;
  }

  spawn(entry: ZooEntry): void {
    const found = this.habitat(entry);
    this.add(entry, found ?? { x: 0, y: 0 }, true);
    this.refused = found ? null : `${entry.name} has no habitat on this ground, it may not appear`;
    this.camera = { centre: found ?? { x: 0, y: 0 }, zoom: this.camera.zoom };
  }

  remove(at: Vec2, reach: number): number {
    const time = this.now();
    const kept = this.actors.filter((one) => {
      const pos = one.pose(time).pos;
      return Math.hypot(pos.x - at.x, pos.y - at.y) > Math.max(reach, one.radius());
    });
    const removed = this.actors.length - kept.length;
    if (removed === 0) return 0;
    this.actors = kept;
    if (this.focused && !kept.includes(this.focused)) this.focused = kept[kept.length - 1] ?? null;
    this.refreshHomes();
    return removed;
  }

  humanCount(): number {
    return this.actors.filter((one) => one.entry.group === 'human').length;
  }

  takeHumans(most: number): { at: Vec2; heading: number }[] {
    const time = this.now();
    const taken = this.actors.filter((one) => one.entry.group === 'human').slice(0, most);
    if (taken.length === 0) return [];
    this.actors = this.actors.filter((one) => !taken.includes(one));
    if (this.focused && taken.includes(this.focused)) this.focused = this.actors[this.actors.length - 1] ?? null;
    return taken.map((one) => ({ at: one.pose(time).pos, heading: one.heading() }));
  }

  clear(): void {
    this.actors = [];
    this.focused = null;
    this.refreshHomes();
  }

  select(at: Vec2): boolean {
    const time = this.now();
    let best: Actor | null = null;
    let nearest = Infinity;
    for (const one of this.actors) {
      const pos = one.pose(time).pos;
      const gap = Math.hypot(pos.x - at.x, pos.y - at.y);
      if (gap <= one.radius() + 0.5 && gap < nearest) {
        best = one;
        nearest = gap;
      }
    }
    if (!best) return false;
    this.focused = best;
    return true;
  }

  send(point: Vec2): void {
    if (!this.focused) return;
    this.refused = this.focused.send(point, this.now());
  }

  startle(point: Vec2): void {
    const time = this.now();
    for (const one of this.actors) one.startle(point, time);
  }

  recentre(): void {
    this.follow = true;
    const { focused } = this;
    if (!focused) return;
    this.camera = { zoom: this.camera.zoom, centre: focused.seen ?? focused.pose(this.now()).pos };
  }

  advance(seconds: number): void {
    const { focused } = this;
    if (!focused || !this.follow) return;
    const pos = focused.seen ?? focused.pose(this.now()).pos;
    const gap = Math.hypot(pos.x - this.camera.centre.x, pos.y - this.camera.centre.y);
    if (gap < FOLLOW_LOCK_METRES) {
      this.camera = { zoom: this.camera.zoom, centre: pos };
      return;
    }
    const ease = 1 - Math.exp(-FOLLOW_RATE * seconds);
    this.camera = {
      zoom: this.camera.zoom,
      centre: {
        x: this.camera.centre.x + (pos.x - this.camera.centre.x) * ease,
        y: this.camera.centre.y + (pos.y - this.camera.centre.y) * ease,
      },
    };
  }

  readout(): ZooReadout | null {
    return this.focused?.readout(this.now(), this.actors.length) ?? null;
  }

  states(flat: boolean): { all: ZooState[]; focus: ZooState | null } {
    return { all: this.actors.map((one) => ({ ...one.state, flat })), focus: this.focused ? { ...this.focused.state, flat } : null };
  }

  agents(): MammalAgents | null {
    const time = this.now();
    const mammals = this.actors.filter((one) => one.entry.group === 'mammal');
    if (mammals.length === 0) return null;
    const ordered = this.focused && mammals.includes(this.focused) ? [this.focused, ...mammals.filter((one) => one !== this.focused)] : mammals;
    const data = new Float32Array(ordered.length * AGENT_FLOATS);
    ordered.forEach((one, index) => one.pack(data, index, time));
    return { count: ordered.length, data, isolated: true, homes: true };
  }

  bodies(): { x: number; y: number; length: number }[] {
    const time = this.now();
    return this.actors.map((one) => {
      const pos = one.pose(time).pos;
      return { x: pos.x, y: pos.y, length: one.entry.length || 1 };
    });
  }

  humans(): HumanDraw[] {
    const time = this.now();
    return this.actors.filter((one) => one.entry.group === 'human').map((one) => one.human(time));
  }
}
