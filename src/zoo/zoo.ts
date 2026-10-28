import { behaviourOf, poseFor } from '../animals/catalogue.ts';
import { MAMMALS } from '../sim/mammals/species.ts';
import { stateIndexOf, statesOf } from '../animals/types.ts';
import type { Camera } from '../render/camera.ts';
import type { ZooState } from '../render/lit/zoo.ts';
import { FACING_RADIANS_PER_SECOND, GLANCE_FROM_METRES, GLANCE_PER_SECOND, turnToward, Walker } from '../sim/animals/walker.ts';
import { AGENT_FLOATS, packAgent } from '../render/lit/mammalAgents.ts';
import type { MammalAgents } from '../render/lit/mammalAgents.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { prng } from '../sim/rng.ts';
import type { World } from '../sim/world.ts';
import type { ZooEntry } from './catalogue.ts';
import { findSpots, suitabilityAt } from './spot.ts';

const FOLLOW_RATE = 4;

const FOLLOW_LOCK_METRES = 3;

const STARTLE_FACTOR = 1.6;

const STARTLE_PACE = 2.4;

const STARTLE_TRIES = 5;

const DEFAULT_ZOOM = 64;

const STEP_METRES = 0.5;

export interface ZooReadout {
  name: string;
  group: string;
  position: Vec2;
  travelling: boolean;
  remaining: number;
  suitability: number;
  speed: number;
}

export class ZooSession {
  entry: ZooEntry | null = null;
  state: ZooState | null = null;
  follow = true;
  camera: Camera = { centre: { x: 0, y: 0 }, zoom: DEFAULT_ZOOM };
  target: Vec2 | null = null;
  seen: Vec2 | null = null;
  refused: string | null = null;

  paused = false;
  private clock = 0;
  private spots: Vec2[] = [];
  private walker: Walker | null = null;
  private facing: Vec2 = { x: 1, y: 0 };
  private glance = 0;
  private den: Vec2 = { x: 0, y: 0 };
  private readonly random = prng(1);
  private hide: { from: number; until: number } | null = null;
  private readonly agentData = new Float32Array(AGENT_FLOATS);

  constructor(readonly world: World) {}

  now(): number {
    return this.clock;
  }

  tick(seconds: number): void {
    if (this.paused) return;
    this.clock += seconds;
    const { entry, walker } = this;
    if (!entry || !walker) return;
    if (entry.roams) {
      walker.update(this.clock);
      this.publish();
    }
    const pose = walker.pose(this.clock);
    const wanted = entry.group === 'mammal' && entry.length >= GLANCE_FROM_METRES ? walker.glance(this.clock) : 0;
    this.glance += (wanted - this.glance) * (1 - Math.exp(-GLANCE_PER_SECOND * seconds));
    this.facing = pose.going || entry.roams ? turnToward(this.facing, pose.dir, FACING_RADIANS_PER_SECOND * seconds) : this.facing;
  }

  spawn(entry: ZooEntry): void {
    if (this.entry !== entry || this.spots.length === 0) this.spots = findSpots(this.world, entry);
    this.entry = entry;
    const found = this.spots[0];
    const spot = found ?? { x: 0, y: 0 };
    this.refused = found ? null : `${entry.name} has no habitat on this ground, it may not appear`;
    this.target = null;
    this.seen = null;
    this.walker = new Walker(spot, entry, (from, to) => this.clear(from, to), prng(entry.life + 1), this.clock);
    this.den = spot;
    this.hide = null;
    this.facing = { x: 1, y: 0 };
    this.glance = 0;
    this.state = { group: entry.group, species: entry.index, home: spot, cell: spot, legs: [] };
    this.camera = { centre: spot, zoom: this.camera.zoom };
  }

  send(point: Vec2): void {
    const { entry, walker } = this;
    if (!entry || !walker) return;
    const time = this.now();
    const here = walker.pose(time).pos;
    const drawn = entry.roams ? here : (this.seen ?? here);
    const aim = { x: point.x - (drawn.x - here.x), y: point.y - (drawn.y - here.y) };
    const pace = behaviourOf(entry.key)?.hooks.command?.({ distance: Math.hypot(aim.x - here.x, aim.y - here.y) }) ?? 1;
    if (!walker.sendTo(aim, time, pace)) {
      this.refused = `${entry.name} cannot go there, the ground in between is not its own`;
      return;
    }
    this.refused = null;
    this.hide = null;
    this.target = point;
    this.publish();
  }

  startle(point: Vec2): void {
    const { entry, walker } = this;
    if (!entry || !walker || entry.group !== 'mammal') return;
    const species = MAMMALS[entry.index]!;
    if (species.skit <= 0) return;
    const time = this.now();
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

  recentre(): void {
    const { walker } = this;
    this.follow = true;
    if (!walker) return;
    this.camera = { zoom: this.camera.zoom, centre: this.seen ?? walker.pose(this.now()).pos };
  }

  advance(seconds: number): void {
    const { walker } = this;
    if (!walker || !this.follow) return;
    const pos = this.seen ?? walker.pose(this.now()).pos;
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
    const { entry, walker } = this;
    if (!entry || !walker) return null;
    const time = this.now();
    const pose = walker.pose(time);
    return {
      name: entry.name,
      group: entry.group,
      position: pose.pos,
      travelling: pose.going,
      remaining: walker.remaining(time),
      suitability: suitabilityAt(this.world, entry, pose.pos),
      speed: walker.speed(),
    };
  }

  agents(): MammalAgents | null {
    const { entry, walker } = this;
    if (!entry || !walker || entry.group !== 'mammal') return null;
    const time = this.now();
    const pose = walker.pose(time);
    if (this.hide && time >= this.hide.until) this.hide = null;
    const behaviour = behaviourOf(entry.key);
    const burrowing = this.hide && time >= this.hide.from ? statesOf(behaviour).indexOf('burrow') : -1;
    const state = burrowing >= 0 ? burrowing : pose.going ? stateIndexOf(behaviour, pose) : 0;
    const since = burrowing >= 0 ? time - this.hide!.from : 0;
    const left = burrowing >= 0 ? this.hide!.until - time : 0;
    packAgent(this.agentData, 0, {
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
    return { count: 1, data: this.agentData, isolated: true };
  }

  private publish(): void {
    const { entry, walker, state } = this;
    if (!entry || !walker || !state) return;
    this.state = { ...state, home: walker.home, travelled: walker.travelled, legs: [...walker.legs] };
  }

  private clear(from: Vec2, to: Vec2): boolean {
    const { entry } = this;
    if (!entry || !entry.bound) return true;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(length / STEP_METRES));
    for (let step = 1; step <= steps; step += 1) {
      const u = step / steps;
      if (suitabilityAt(this.world, entry, { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u }) <= 0) return false;
    }
    return true;
  }
}
