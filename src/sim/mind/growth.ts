import { NEURON_COUNT, isRoot, parentsOf } from './neurons.ts';

export interface Place {
  x: number;
  y: number;
}

export type Places = Map<number, Place>;

export const ROOT_RADIUS = 66;

export const GROWTH_STEP = 52;

export const SPACING = 44;

export const BRAIN_RADIUS = 190;

const SEARCH_TRIES = 120;

const ARC_STEP = 12;

const SHELL_TRIES = 20;

const SHELL_STEP = 16;

const hash = (a: number, b: number): number => {
  let mix = Math.imul(a + 0x9e3779b1, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  mix ^= mix >>> 15;
  mix = Math.imul(mix, 0x2c1b3c6d);
  return ((mix ^ (mix >>> 12)) >>> 0) / 0xffffffff;
};

const roomAt = (places: Places, x: number, y: number): number => {
  let least = Infinity;
  for (const place of places.values()) least = Math.min(least, Math.hypot(place.x - x, place.y - y));
  return least;
};

function widestGap(angles: number[], fallback: number): number {
  if (angles.length === 0) return fallback;
  const sorted = [...angles].sort((a, b) => a - b);
  let best = sorted[0]! + Math.PI;
  let widest = -1;
  sorted.forEach((angle, at) => {
    const next = at + 1 < sorted.length ? sorted[at + 1]! : sorted[0]! + Math.PI * 2;
    if (next - angle > widest) {
      widest = next - angle;
      best = angle + (next - angle) / 2;
    }
  });
  return best;
}

function settle(places: Places, angle: number, radius: number): Place {
  let best: Place | null = null;
  let roomiest = -1;
  for (let attempt = 0; attempt < SEARCH_TRIES; attempt += 1) {
    const shell = Math.floor(attempt / SHELL_TRIES);
    const within = attempt % SHELL_TRIES;
    const reach = Math.min(BRAIN_RADIUS, radius + shell * SHELL_STEP);
    const turn = ((within % 2 === 0 ? 1 : -1) * Math.ceil(within / 2) * ARC_STEP) / reach;
    const x = Math.round(Math.sin(angle + turn) * reach);
    const y = Math.round(-Math.cos(angle + turn) * reach);
    const room = roomAt(places, x, y);
    if (room >= SPACING) return { x, y };
    if (room > roomiest) {
      roomiest = room;
      best = { x, y };
    }
  }
  return best ?? { x: 0, y: -radius };
}

export function placeFor(neuron: number, places: Places, salt: number): Place {
  const jitter = hash(neuron * 7 + 3, salt) - 0.5;
  const anchors = parentsOf(neuron)
    .map((parent) => places.get(parent))
    .filter((place): place is Place => place !== undefined);
  if (anchors.length === 0) {
    const around = [...places.values()].map((place) => Math.atan2(place.x, -place.y));
    const angle = widestGap(around, hash(neuron, salt) * Math.PI * 2) + jitter * 0.3;
    return settle(places, angle, (isRoot(neuron) ? ROOT_RADIUS : ROOT_RADIUS + GROWTH_STEP) + Math.round(jitter * 10));
  }
  const cx = anchors.reduce((sum, place) => sum + place.x, 0) / anchors.length;
  const cy = anchors.reduce((sum, place) => sum + place.y, 0) / anchors.length;
  const out = Math.hypot(cx, cy);
  const angle = (out > 4 ? Math.atan2(cx, -cy) : hash(neuron, salt + 1) * Math.PI * 2) + jitter * 0.35;
  return settle(places, angle, Math.max(ROOT_RADIUS, out) + GROWTH_STEP);
}

export function grow(places: Places, wanted: (neuron: number) => boolean, salt: number): boolean {
  let changed = false;
  for (let strict = 1; strict >= 0; strict -= 1) {
    let moved = true;
    while (moved) {
      moved = false;
      for (let neuron = 0; neuron < NEURON_COUNT; neuron += 1) {
        if (places.has(neuron) || !wanted(neuron)) continue;
        if (strict === 1 && parentsOf(neuron).some((parent) => wanted(parent) && !places.has(parent))) continue;
        places.set(neuron, placeFor(neuron, places, salt));
        moved = true;
        changed = true;
      }
    }
  }
  return changed;
}
