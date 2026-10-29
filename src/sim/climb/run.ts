import type { Vec2 } from '../geometry.ts';
import type { Ability, ClimbHabits } from './ability.ts';
import type { Forest, Reach } from './forest.ts';
import { refOf, tileOfRef } from './forest.ts';
import type { Link } from './forest.ts';

export type Move = Link | 'walk' | 'perch' | 'rear';

export type Mode = 'climb' | 'leap' | 'perch' | 'rear';

export interface Waypoint {
  x: number;
  y: number;
  z: number;
  time: number;
  move: Move;
}

export interface ClimbRun {
  start: number;
  end: number;
  points: Waypoint[];
  total: number;
  base: Vec2;
  relocated: boolean;
}

export interface ClimbPose {
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirY: number;
  moving: boolean;
  mode: Mode;
  pitch: number;
  travelled: number;
}

const PLAN_STEPS = 300;

const CLIMB_SPEED_SHARE = 0.5;

const MIN_CLIMB_SPEED = 0.25;

const LEAP_SPEED_GAIN = 3;

const GLIDE_SPEED_GAIN = 4;

const MIN_LEAP_SECONDS = 0.3;

const ARC_SHARE = 0.2;

const TOP_SHARE = 0.3;

const BEST_CHOICES = 5;

const speedOf = (move: Move, speed: number): number => (move === 'jump' ? speed * LEAP_SPEED_GAIN : move === 'glide' ? speed * GLIDE_SPEED_GAIN : Math.max(MIN_CLIMB_SPEED, speed * CLIMB_SPEED_SHARE));

const MAX_HOPS = 6;

const REAR_SECONDS = 1.4;

export const planRun = (forest: Forest, ability: Ability, habits: ClimbHabits, tile: number, speed: number, start: number, random: () => number): ClimbRun | null => {
  const reach = forest.reach(tile, ability, PLAN_STEPS);
  if (reach.cost.size < 3) return null;
  const choose = (from: Reach, here: number): number | null => {
    const candidates: { ref: number; score: number }[] = [];
    for (const ref of from.cost.keys()) {
      if (ref === here) continue;
      const node = forest.node(ref)!;
      const tree = forest.tree(tileOfRef(ref))!;
      const share = node.z / tree.metres;
      if (share < TOP_SHARE) continue;
      candidates.push({ ref, score: share + (tileOfRef(ref) === tileOfRef(here) ? 0 : 0.4) + random() * 0.15 });
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score || a.ref - b.ref);
    return candidates[Math.min(candidates.length - 1, Math.floor(random() * BEST_CHOICES))]!.ref;
  };
  let goal = choose(reach, refOf(tile, 0));
  if (goal === null) return null;
  const points: Waypoint[] = [];
  let time = start;
  let total = 0;
  const push = (ref: number, move: Move): void => {
    const node = forest.node(ref)!;
    const previous = points[points.length - 1];
    if (previous) {
      const distance = Math.hypot(node.x - previous.x, node.y - previous.y, node.z - previous.z);
      time += Math.max(move === 'jump' || move === 'glide' ? MIN_LEAP_SECONDS : 0.05, distance / speedOf(move, speed));
      total += distance;
    }
    points.push({ x: node.x, y: node.y, z: node.z, time, move });
  };
  const hold = (move: Move, seconds: number): void => {
    const top = points[points.length - 1]!;
    time += seconds;
    points.push({ x: top.x, y: top.y, z: top.z, time, move });
  };
  const perch = (): void => {
    const top = points[points.length - 1]!;
    const [shortest, longest] = habits.perch;
    time += shortest + random() * (longest - shortest);
    points.push({ x: top.x, y: top.y, z: top.z, time, move: 'perch' });
  };
  const follow = (from: Reach, to: number): void => {
    const path = forest.path(from, to);
    path.forEach((ref, at) => {
      push(ref, at === 0 ? 'walk' : from.links.get(ref) ?? 'limb');
      if (at === 0) hold('rear', REAR_SECONDS);
    });
  };
  const climbed: number[] = [];
  follow(reach, goal);
  climbed.push(...forest.path(reach, goal));
  perch();
  for (let hop = 0; hop < MAX_HOPS && random() < habits.arboreal; hop += 1) {
    const onward = forest.reachFrom(goal, ability, PLAN_STEPS);
    const next = choose(onward, goal);
    if (next === null) break;
    const path = forest.path(onward, next);
    path.slice(1).forEach((ref) => push(ref, onward.links.get(ref) ?? 'limb'));
    climbed.push(...path.slice(1));
    goal = next;
    perch();
  }
  const home = forest.reach(tileOfRef(goal), ability, PLAN_STEPS);
  const own = forest.path(home, goal);
  const descend = home.cost.has(goal) && own.every((ref) => tileOfRef(ref) === tileOfRef(goal)) ? [...own].reverse() : [...climbed].reverse();
  descend.slice(1).forEach((ref) => push(ref, 'limb'));
  hold('rear', REAR_SECONDS * 0.6);
  const last = points[points.length - 1]!;
  return { start, end: last.time, points, total, base: { x: last.x, y: last.y }, relocated: false };
};

export const poseAt = (run: ClimbRun, time: number): ClimbPose | null => {
  if (time < run.start) return null;
  const { points } = run;
  let covered = 0;
  let dirX = 1;
  let dirY = 0;
  for (let at = 1; at < points.length; at += 1) {
    const from = points[at - 1]!;
    const to = points[at]!;
    const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    const flat = Math.hypot(to.x - from.x, to.y - from.y);
    if (flat > 0.01) {
      dirX = (to.x - from.x) / flat;
      dirY = (to.y - from.y) / flat;
    }
    if (time < to.time) {
      const s = (time - from.time) / Math.max(1e-6, to.time - from.time);
      const arc = to.move === 'jump' ? ARC_SHARE * flat * 4 * s * (1 - s) : 0;
      const steep = Math.min(Math.PI / 2, Math.atan2(Math.abs(to.z - from.z), flat));
      return {
        x: from.x + (to.x - from.x) * s,
        y: from.y + (to.y - from.y) * s,
        z: from.z + (to.z - from.z) * s + arc,
        dirX,
        dirY,
        moving: to.move !== 'perch' && to.move !== 'rear',
        mode: to.move === 'jump' || to.move === 'glide' ? 'leap' : to.move === 'perch' ? 'perch' : to.move === 'rear' ? 'rear' : 'climb',
        pitch: steep,
        travelled: covered + length * s,
      };
    }
    covered += length;
  }
  const last = points[points.length - 1]!;
  return { x: last.x, y: last.y, z: last.z, dirX, dirY, moving: false, mode: 'rear', pitch: 0, travelled: covered };
};
