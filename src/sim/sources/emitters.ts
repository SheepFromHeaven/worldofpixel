import type { World } from '../world.ts';
import type { People } from '../people/people.ts';
import { reachScale } from './fuel.ts';
import { HeatSource } from './heatSource.ts';
import type { LightBehaviour } from './lightSource.ts';
import { LightSource } from './lightSource.ts';

export type Look = 'fire' | 'post' | 'hand' | 'glow';

export class EmitterKind {
  constructor(
    readonly look: Look,
    readonly heat: HeatSource | null,
    readonly light: LightSource | null,
  ) {}
}

const FLAME = [1, 0.62, 0.3] as const;

export const TORCH_LIFT_TILES = 0.95;

const CAMPFIRE_LIGHT: LightBehaviour = { flicker: 1, windShare: 0.5, flame: 'campfire', lift: 0 };

const TORCH_LIGHT: LightBehaviour = { flicker: 1, windShare: 1, flame: 'torch', lift: TORCH_LIFT_TILES };

const WINDOW_LIGHT: LightBehaviour = { flicker: 0.08, windShare: 0, flame: 'none', lift: 0 };

const CARRIED_LIGHT: LightBehaviour = { flicker: 1, windShare: 1, flame: 'none', lift: 0 };

export const CAMPFIRE = new EmitterKind('fire', new HeatSource(7, 1), new LightSource(7, 1.35, [1, 0.58, 0.26], CAMPFIRE_LIGHT));

export const STANDING_TORCH = new EmitterKind('post', new HeatSource(3.5, 0.4), new LightSource(4.5, 1.1, FLAME, TORCH_LIGHT));

export const HELD_TORCH = new EmitterKind('hand', new HeatSource(2.2, 0.25), new LightSource(3.2, 0.8, FLAME, CARRIED_LIGHT));

export const BURNING_BRANCH = new EmitterKind('hand', new HeatSource(2.6, 0.3), new LightSource(3.6, 0.65, FLAME, CARRIED_LIGHT));

export const HUT_WINDOW = new EmitterKind('glow', null, new LightSource(3.5, 0.55, [1, 0.72, 0.36], WINDOW_LIGHT));

export interface Emitter {
  id: number;
  kind: EmitterKind;
  x: number;
  y: number;
  level: number;
}

export const FIRE_IDS = 100_000;

export const TORCH_IDS = 200_000;

export const HELD_IDS = 300_000;

export const LYING_IDS = 400_000;

export const HUT_IDS = 500_000;

export const IGNITER_REACH_TILES = 8;

export type EmitterSource = (world: World, people: People, out: Emitter[]) => void;

export function gather(sources: readonly EmitterSource[], world: World, people: People): Emitter[] {
  const found: Emitter[] = [];
  for (const source of sources) source(world, people, found);
  return found;
}

export function warmthFrom(emitters: readonly Emitter[], x: number, y: number): number {
  let warmest = 0;
  for (const emitter of emitters) {
    const { heat } = emitter.kind;
    if (!heat) continue;
    const scale = reachScale(emitter.level);
    const warmth = heat.warmthAt((emitter.x - x) / scale, (emitter.y - y) / scale) * emitter.level;
    if (warmth > warmest) warmest = warmth;
  }
  return warmest;
}

export function igniterIn(emitters: readonly Emitter[], x: number, y: number): boolean {
  for (const emitter of emitters) {
    if (emitter.kind !== CAMPFIRE && emitter.kind !== BURNING_BRANCH) continue;
    if (Math.hypot(emitter.x - x, emitter.y - y) <= IGNITER_REACH_TILES) return true;
  }
  return false;
}
