import { CAMPFIRE as CAMPFIRE_DEF } from '../content/stations/campfire/index.ts';
import type { Emits } from '../../../content/stations/definition.ts';
import { TORCH as TORCH_DEF } from '../content/stations/torch/index.ts';
import type { World } from '../../../sim/world.ts';
import type { People } from '../../people/api.ts';
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
    readonly igniter: boolean = false,
  ) {}
}

const FLAME = [1, 0.62, 0.3] as const;

export const TORCH_LIFT_TILES = 0.95;

const CARRIED_LIGHT: LightBehaviour = { flicker: 1, windShare: 1, flame: 'none', lift: 0 };

const kinds = new WeakMap<Emits, EmitterKind>();

export function kindOf(emits: Emits): EmitterKind {
  let kind = kinds.get(emits);
  if (!kind) {
    const { heat, light } = emits;
    kind = new EmitterKind(
      emits.look,
      heat ? new HeatSource(heat.reach, heat.output) : null,
      light ? new LightSource(light.reach, light.strength, light.colour, { flicker: light.flicker, windShare: light.windShare, flame: light.flame, lift: light.lift }) : null,
      emits.igniter,
    );
    kinds.set(emits, kind);
  }
  return kind;
}

export const CAMPFIRE = kindOf(CAMPFIRE_DEF.emits!);

export const STANDING_TORCH = kindOf(TORCH_DEF.emits!);

export const HELD_TORCH = new EmitterKind('hand', new HeatSource(2.2, 0.25), new LightSource(3.2, 0.8, FLAME, CARRIED_LIGHT));

export const BURNING_BRANCH = new EmitterKind('hand', new HeatSource(2.6, 0.3), new LightSource(3.6, 0.65, FLAME, CARRIED_LIGHT), true);

export interface Emitter {
  id: number;
  kind: EmitterKind;
  x: number;
  y: number;
  level: number;
}

export const STATION_IDS = 100_000;

export const HELD_IDS = 300_000;

export const LYING_IDS = 400_000;

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
    if (!emitter.kind.igniter) continue;
    if (Math.hypot(emitter.x - x, emitter.y - y) <= IGNITER_REACH_TILES) return true;
  }
  return false;
}
