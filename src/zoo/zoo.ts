import type { Camera } from '../render/camera.ts';
import type { ZooLeg, ZooState } from '../render/lit/zoo.ts';
import { ZOO_LEGS, zooAnchor } from '../render/lit/zoo.ts';
import type { Vec2 } from '../sim/geometry.ts';
import type { World } from '../sim/world.ts';
import type { ZooEntry } from './catalogue.ts';
import { findSpots, suitabilityAt } from './spot.ts';

const MIN_SPEED = 0.15;

const MIN_TRAVEL_SECONDS = 0.3;

const FOLLOW_RATE = 4;

const DEFAULT_ZOOM = 64;

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
  private rank = 0;

  paused = false;
  private clock = 0;
  private spots: Vec2[] = [];

  constructor(readonly world: World) {}

  now(): number {
    return this.clock;
  }

  tick(seconds: number): void {
    if (!this.paused) this.clock += seconds;
  }

  spawn(entry: ZooEntry, rank = 0): void {
    if (this.entry !== entry || this.spots.length === 0) this.spots = findSpots(this.world, entry);
    this.entry = entry;
    const spot = this.spots[rank % Math.max(1, this.spots.length)];
    if (!spot) {
      this.state = null;
      this.refused = `${entry.name} has no habitat in this world`;
      return;
    }
    this.rank = rank;
    this.refused = null;
    this.target = null;
    this.seen = null;
    this.state = { group: entry.group, species: entry.index, home: spot, legs: [] };
    this.camera = { centre: spot, zoom: this.camera.zoom };
  }

  elsewhere(): void {
    if (this.entry) this.spawn(this.entry, this.rank + 1);
  }

  send(point: Vec2): void {
    const { entry, state } = this;
    if (!entry || !state) return;
    if ((entry.group === 'reptile' || entry.group === 'mammal' || entry.group === 'amphibian') && suitabilityAt(this.world, entry, point) <= 0) {
      this.refused = `${entry.name} cannot live there`;
      return;
    }
    this.refused = null;
    const time = this.now();
    const here = zooAnchor(state, time).pos;
    const legs: ZooLeg[] = state.legs.map((leg) => (leg.end > time ? { ...leg, to: here, end: time } : leg));
    let home = state.home;
    if (legs.length >= ZOO_LEGS) {
      legs.length = 0;
      home = here;
    }
    const speed = Math.max(MIN_SPEED, entry.speed);
    const seconds = Math.max(MIN_TRAVEL_SECONDS, Math.hypot(point.x - here.x, point.y - here.y) / speed);
    legs.push({ from: here, to: point, start: time, end: time + seconds });
    this.state = { ...state, home, legs };
    this.target = point;
  }

  advance(seconds: number): void {
    const { state } = this;
    if (!state || !this.follow) return;
    const pos = this.seen ?? zooAnchor(state, this.now()).pos;
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
    const { entry, state } = this;
    if (!entry || !state) return null;
    const time = this.now();
    const anchor = zooAnchor(state, time);
    const last = state.legs[state.legs.length - 1];
    return {
      name: entry.name,
      group: entry.group,
      position: anchor.pos,
      travelling: anchor.going,
      remaining: anchor.going && last ? Math.hypot(last.to.x - anchor.pos.x, last.to.y - anchor.pos.y) : 0,
      suitability: suitabilityAt(this.world, entry, anchor.pos),
      speed: Math.max(MIN_SPEED, entry.speed),
    };
  }
}
