import type { WanderContext, Wander } from '../../animals/types.ts';
import type { Vec2 } from '../geometry.ts';
import type { Random } from '../rng.ts';

export interface Leg {
  from: Vec2;
  via: Vec2;
  to: Vec2;
  heading: number;
  spin: number;
  speed: number;
  pace: number;
  start: number;
  turned: number;
  end: number;
}

export interface Habits {
  speed: number;
  reach: number;
  rest: number;
  restless: boolean;
  radius: number;
  wander?: (context: WanderContext) => Wander | null;
}

export interface Pose {
  pos: Vec2;
  dir: Vec2;
  going: boolean;
  pace: number;
}

export type Passable = (from: Vec2, to: Vec2) => boolean;

export const MIN_SPEED = 0.15;

export const MAX_LEGS = 12;

const MIN_TRAVEL_SECONDS = 0.3;

const WALK_MIN_METRES = 2;

const WALK_MAX_METRES = 18;

const WALK_SHARE_OF_REACH = 0.3;

const TRIES = 16;

const BLOCKED_RETRY_SECONDS = 1;

const FIRST_REST_SECONDS = 0.6;

const LONGEST_REST_SECONDS = 20;

const TURN_LIMIT = 1.2;

const CONTINUOUS_LEAD_SECONDS = 0.25;

const SMALLEST_RADIUS = 0.1;

const TURN_STEP_SECONDS = 0.05;

const TURN_STEP_RADIANS = 0.2;

const TURN_LIMIT_RADIANS = Math.PI * 2;

export const FACING_RADIANS_PER_SECOND = 10;

export const GLANCE_FROM_METRES = 1.1;

export const MAX_GLANCE = 0.5;

export const GLANCE_PER_SECOND = 5;

export const turnRadiusOf = (length: number): number => Math.max(SMALLEST_RADIUS, length);

const wrap = (angle: number): number => {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
};

const lengthOf = (leg: Leg): number => leg.speed * (leg.end - leg.start);

const at = (leg: Leg, time: number): Pose => {
  const t = Math.min(time, leg.end);
  if (t < leg.turned) {
    const tau = t - leg.start;
    const theta = leg.heading + leg.spin * tau;
    const reach = leg.speed / leg.spin;
    return {
      pos: { x: leg.from.x + reach * (Math.sin(theta) - Math.sin(leg.heading)), y: leg.from.y - reach * (Math.cos(theta) - Math.cos(leg.heading)) },
      dir: { x: Math.cos(theta), y: Math.sin(theta) },
      going: time < leg.end,
      pace: leg.pace,
    };
  }
  const dx = leg.to.x - leg.via.x;
  const dy = leg.to.y - leg.via.y;
  const length = Math.hypot(dx, dy);
  const dir = length > 0.001 ? { x: dx / length, y: dy / length } : { x: Math.cos(leg.heading + leg.spin * (leg.turned - leg.start)), y: Math.sin(leg.heading + leg.spin * (leg.turned - leg.start)) };
  const run = leg.speed * (t - leg.turned);
  return { pos: { x: leg.via.x + dir.x * run, y: leg.via.y + dir.y * run }, dir, going: time < leg.end, pace: leg.pace };
};

export const turnToward = (facing: Vec2, target: Vec2, maxRadians: number): Vec2 => {
  const current = Math.atan2(facing.y, facing.x);
  const wanted = Math.atan2(target.y, target.x);
  let difference = wanted - current;
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;
  const next = current + Math.max(-maxRadians, Math.min(maxRadians, difference));
  return { x: Math.cos(next), y: Math.sin(next) };
};

export class Walker {
  home: Vec2;
  travelled = 0;
  legs: Leg[] = [];
  private homeDir: Vec2 = { x: 1, y: 0 };
  private heading: number;
  private nextWalk: number;

  constructor(
    home: Vec2,
    private readonly habits: Habits,
    private readonly passable: Passable,
    private readonly random: Random,
    now: number,
    private readonly maxLegs = MAX_LEGS,
    private readonly retain = 0,
  ) {
    this.home = home;
    this.heading = random() * Math.PI * 2;
    this.nextWalk = now + FIRST_REST_SECONDS;
  }

  speed(): number {
    return Math.max(MIN_SPEED, this.habits.speed);
  }

  pose(time: number): Pose {
    let pose: Pose = { pos: this.home, dir: this.homeDir, going: false, pace: 1 };
    for (const leg of this.legs) {
      if (leg.end <= leg.start || time < leg.start) break;
      pose = at(leg, time);
    }
    return pose;
  }

  distance(time: number): number {
    let total = this.travelled;
    for (const leg of this.legs) {
      if (time <= leg.start) break;
      total += leg.speed * (Math.min(time, leg.end) - leg.start);
    }
    return total;
  }

  glance(time: number): number {
    for (const leg of this.legs) {
      if (time < leg.start || time >= leg.end) continue;
      const { pos, dir } = at(leg, time);
      const off = wrap(Math.atan2(leg.to.y - pos.y, leg.to.x - pos.x) - Math.atan2(dir.y, dir.x));
      return MAX_GLANCE * Math.tanh(off / MAX_GLANCE);
    }
    return 0;
  }

  endsAt(now: number): number {
    const last = this.legs[this.legs.length - 1];
    return last ? last.end : now;
  }

  remaining(time: number): number {
    const last = this.legs[this.legs.length - 1];
    return last && time < last.end ? last.speed * (last.end - Math.max(time, last.start)) : 0;
  }

  holdUntil(time: number): void {
    this.nextWalk = Math.max(this.nextWalk, time);
  }

  sendTo(point: Vec2, time: number, pace = 1): boolean {
    const here = this.pose(time).pos;
    if (!this.passable(here, point)) return false;
    this.legs = this.legs.filter((leg) => leg.start < time).map((leg) => (leg.end > time ? { ...leg, end: time } : leg));
    this.addLeg(here, point, time, time, pace);
    this.heading = Math.atan2(point.y - here.y, point.x - here.x);
    this.nextWalk = this.endsAt(time) + this.restSeconds();
    return true;
  }

  update(time: number, active = true): void {
    if (!active) return;
    const lead = this.habits.restless ? CONTINUOUS_LEAD_SECONDS : 0;
    const start = Math.max(time, this.endsAt(time), this.nextWalk);
    if (start - time > lead) return;
    const here = this.pose(start).pos;
    const longest = Math.min(WALK_MAX_METRES, Math.max(WALK_MIN_METRES, this.habits.reach * WALK_SHARE_OF_REACH));
    for (let attempt = 0; attempt < TRIES; attempt += 1) {
      const custom = this.habits.wander?.({ heading: this.heading, longest, random: this.random });
      const turn = custom ? custom.turn : this.habits.restless ? (this.random() * 2 - 1) * TURN_LIMIT : (this.random() * 2 - 1) * Math.PI;
      const angle = this.heading + turn;
      const distance = custom ? custom.distance : longest * (0.35 + 0.65 * this.random());
      const to = { x: here.x + Math.cos(angle) * distance, y: here.y + Math.sin(angle) * distance };
      if (!this.passable(here, to)) continue;
      this.addLeg(here, to, start, time, custom?.pace ?? 1);
      this.heading = angle;
      this.nextWalk = this.endsAt(time) + this.restSeconds();
      return;
    }
    this.nextWalk = start + BLOCKED_RETRY_SECONDS;
  }

  private restSeconds(): number {
    if (this.habits.restless) return 0;
    return Math.min(LONGEST_REST_SECONDS, this.habits.rest) * (0.5 + this.random());
  }

  private addLeg(from: Vec2, to: Vec2, start: number, now: number, pace = 1): void {
    if (this.legs.length >= this.maxLegs) {
      const done = this.legs.filter((leg) => leg.end <= now - this.retain);
      this.travelled += done.reduce((sum, leg) => sum + lengthOf(leg), 0);
      const last = done[done.length - 1];
      if (last) {
        this.home = at(last, last.end).pos;
        this.homeDir = at(last, last.end).dir;
      }
      this.legs = this.legs.filter((leg) => leg.end > now - this.retain);
    }
    const speed = this.speed() * pace;
    const heading = this.pose(start).dir;
    const theta0 = Math.atan2(heading.y, heading.x);
    const omega = speed / this.habits.radius;
    const step = Math.min(TURN_STEP_SECONDS, TURN_STEP_RADIANS / omega);
    let theta = theta0;
    let x = from.x;
    let y = from.y;
    let spin = 0;
    let elapsed = 0;
    let turned = 0;
    const first = wrap(Math.atan2(to.y - y, to.x - x) - theta);
    if (Math.abs(first) > 0.02) {
      spin = Math.sign(first) * omega;
      while (turned < TURN_LIMIT_RADIANS) {
        const wanted = wrap(Math.atan2(to.y - y, to.x - x) - theta);
        if (Math.sign(wanted) !== Math.sign(first) || Math.abs(wanted) < omega * step) break;
        theta += spin * step;
        x += Math.cos(theta) * speed * step;
        y += Math.sin(theta) * speed * step;
        elapsed += step;
        turned += Math.abs(spin) * step;
      }
    }
    const reach = spin === 0 ? 0 : speed / spin;
    const via = spin === 0 ? from : { x: from.x + reach * (Math.sin(theta0 + spin * elapsed) - Math.sin(theta0)), y: from.y - reach * (Math.cos(theta0 + spin * elapsed) - Math.cos(theta0)) };
    const run = Math.max(MIN_TRAVEL_SECONDS, Math.hypot(to.x - via.x, to.y - via.y) / speed);
    this.legs.push({ from, via, to, heading: theta0, spin, speed, pace, start, turned: start + elapsed, end: start + elapsed + run });
  }
}
