import type { FishSpecies } from '../../sim/fish/species.ts';
import { activityOf, FISH, GLIDE } from '../../sim/fish/species.ts';
import type { Shoals } from '../../sim/fish/shoals.ts';
import { DEPTH_UNIT_METRES } from '../../sim/aquatic.ts';
import { behaviourOf } from '../../animals/catalogue.ts';
import { shadersOf } from '../../animals/registry.ts';
import type { FishHabits } from '../../animals/types.ts';
import { hash2 } from '../../sim/rng.ts';
import type { LitView } from './litLayer.ts';

export const FLOATS_PER_FISH = 12;

export const FISH_APPEAR_AT_ZOOM = 3;
export const FISH_FULL_AT_ZOOM = 5;
const SINGLES_FROM_ZOOM = 9;
const MAX_DRAWN_PER_SHOAL = 14;
const VIEW_MARGIN_TILES = 6;
const SHALLOW_ALPHA = 0.55;
const DEEP_FADE = 0.35;
const FADE_FROM_METRES = 2;
const FADE_TO_METRES = 20;
const MIN_BLOB_DIAMETER = 1.4;
const SHADOW_SCALE = 1.3;
const MIN_SHADOW_METRES = 0.16;
const WEAVE_PER_SECOND = 0.35;
const DARTS_REMEMBERED = 4;
const SETTLE_SECONDS = 5;
const VELOCITY_STEP = 0.06;
const TURN_WINDOW = 0.5;
const TURN_MIN_TILES = 0.005;
const MAX_BEND = 1.4;
const BEND_GAIN = 2;
const BLOB_FLAG = 10;
const MODEL_LENGTHS = 1.2;
const TEXELS_PER_METRE = 16;
const HOLD_PER_SECOND = 0.13;

const STYLES = FISH.map((species) => {
  const at = shadersOf('fish').findIndex((one) => one.key === species.key);
  const habits = behaviourOf(species.key)?.habits as FishHabits | undefined;
  return { profile: at + 1, beat: habits?.beat ?? 4, still: habits?.still ?? 0, tight: habits?.tight ?? 1 };
});

const shadowLength = (metres: number): number => Math.max(MIN_SHADOW_METRES, metres * SHADOW_SCALE);

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

function dartOffset(species: FishSpecies, reach: number, shoal: number, fish: number, time: number, activity: number): [number, number] {
  const { period, chance, lengths, seconds } = species.dart;
  const epoch = Math.floor(time / period);
  let x = 0;
  let y = 0;
  for (let back = 0; back < DARTS_REMEMBERED; back += 1) {
    const k = epoch - back;
    const roll = hash2(shoal * 131 + fish, k, 21);
    if (roll > chance * activity) continue;
    const start = (k + hash2(shoal * 131 + fish, k, 22) * 0.6) * period;
    const since = time - start;
    if (since < 0) continue;
    const angle = hash2(shoal * 131 + fish, k, 23) * Math.PI * 2;
    const strength = reach * lengths * (0.6 + 0.4 * hash2(shoal * 131 + fish, k, 24));
    const reachNow = since < seconds ? easeOut(since / seconds) : Math.exp(-(since - seconds) / SETTLE_SECONDS);
    x += Math.cos(angle) * strength * reachNow;
    y += Math.sin(angle) * strength * reachNow;
  }
  return [x, y];
}

function placeOf(species: FishSpecies, reach: number, shoal: number, fish: number, time: number, spread: number, centre: readonly [number, number], activity: number, hold: number): [number, number] {
  const angle = hash2(shoal, fish, 11) * Math.PI * 2;
  const radius = Math.sqrt(hash2(shoal, fish, 12)) * spread;
  const phase = time * WEAVE_PER_SECOND + hash2(shoal, fish, 13) * 6.28;
  const amplitude = reach * (0.2 + 0.25 * hash2(shoal, fish, 17)) * (0.4 + 0.6 * activity) * (1 - hold);
  const wobble = hash2(shoal, fish, 18) * 0.5 + 0.7;
  const [dx, dy] = dartOffset(species, reach, shoal, fish, time, activity);
  return [
    centre[0] + Math.cos(angle) * radius + Math.sin(phase) * amplitude + dx,
    centre[1] + Math.sin(angle) * radius + Math.cos(phase * wobble) * amplitude + dy,
  ];
}

const wrapAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

export function fishInstances(shoals: Shoals, view: LitView, daylight: number): { data: Float32Array; count: number } {
  const halfWidth = view.width / (2 * view.zoom) + VIEW_MARGIN_TILES;
  const halfHeight = view.height / (2 * view.zoom) + VIEW_MARGIN_TILES;
  const minX = view.centre.x - halfWidth;
  const maxX = view.centre.x + halfWidth;
  const minY = view.centre.y - halfHeight;
  const maxY = view.centre.y + halfHeight;
  const singles = view.zoom >= SINGLES_FROM_ZOOM;

  const out: number[] = [];
  for (let i = 0; i < shoals.n; i += 1) {
    const id = shoals.species[i]!;
    if (id === 0) continue;
    const x = shoals.posX[i]!;
    const y = shoals.posY[i]!;
    if (x < minX || x > maxX || y < minY || y > maxY) continue;
    const species = FISH[id - 1]!;
    const style = STYLES[id - 1]!;
    const reach = shadowLength(species.length);
    const size = shoals.size[i]!;
    const depth = shoals.depth[i]! * DEPTH_UNIT_METRES;
    const activity = activityOf(species, daylight);
    const alpha = (SHALLOW_ALPHA - DEEP_FADE * smooth(FADE_FROM_METRES, FADE_TO_METRES, depth)) * (0.65 + 0.35 * activity);
    const heading = shoals.heading[i]!;

    if (!singles) {
      const diameter = Math.max(MIN_BLOB_DIAMETER, reach * (1.5 + 0.6 * Math.sqrt(size)));
      out.push(x, y, heading, diameter, alpha * 0.8, 0, BLOB_FLAG, 0, 0, 0, 0, 0);
      continue;
    }

    const drawn = Math.min(size, MAX_DRAWN_PER_SHOAL);
    const spread = reach * (0.9 + 0.3 * Math.sqrt(size)) * style.tight;
    const cruise = species.speed * GLIDE;
    const vx = Math.cos(heading) * cruise;
    const vy = Math.sin(heading) * cruise;
    for (let j = 0; j < drawn; j += 1) {
      const hold = style.still * smooth(0.3, 0.7, 0.5 + 0.5 * Math.sin(view.time * HOLD_PER_SECOND + hash2(i, j, 41) * 6.28));
      const now = placeOf(species, reach, i, j, view.time, spread, [x, y], activity, hold);
      const before = placeOf(species, reach, i, j, view.time - VELOCITY_STEP, spread, [x - vx * VELOCITY_STEP, y - vy * VELOCITY_STEP], activity, hold);
      const wx = (now[0] - before[0]) / VELOCITY_STEP;
      const wy = (now[1] - before[1]) / VELOCITY_STEP;
      const pace = Math.hypot(wx, wy);
      const effort = Math.min(1, pace / (reach * 6));
      const behind = placeOf(species, reach, i, j, view.time - TURN_WINDOW, spread, [x - vx * TURN_WINDOW, y - vy * TURN_WINDOW], activity, hold);
      const ahead = placeOf(species, reach, i, j, view.time + TURN_WINDOW, spread, [x + vx * TURN_WINDOW, y + vy * TURN_WINDOW], activity, hold);
      const backX = now[0] - behind[0];
      const backY = now[1] - behind[1];
      const foreX = ahead[0] - now[0];
      const foreY = ahead[1] - now[1];
      const moving = Math.hypot(backX, backY) > TURN_MIN_TILES && Math.hypot(foreX, foreY) > TURN_MIN_TILES;
      const facing = moving ? Math.atan2(ahead[1] - behind[1], ahead[0] - behind[0]) : heading;
      const turn = moving ? wrapAngle(Math.atan2(foreY, foreX) - Math.atan2(backY, backX)) : 0;
      const size = reach * (0.85 + 0.3 * hash2(i, j, 15));
      const curvature = moving ? (turn / (Math.hypot(backX, backY) + Math.hypot(foreX, foreY))) * size * BEND_GAIN : 0;
      out.push(
        now[0],
        now[1],
        facing,
        size,
        alpha,
        hash2(i, j, 16) * 6.28,
        Math.max(-MAX_BEND, Math.min(MAX_BEND, curvature)),
        effort * (1 - 0.8 * hold),
        style.profile,
        (size * TEXELS_PER_METRE) / MODEL_LENGTHS,
        style.beat,
        facing,
      );
    }
  }
  return { data: new Float32Array(out), count: out.length / FLOATS_PER_FISH };
}
