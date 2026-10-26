import type { World } from '../world.ts';
import type { People } from '../people/people.ts';
import { ItemType } from '../people/items.ts';
import { fireLevel, reachScale } from './fuel.ts';
import { HeatSource } from './heatSource.ts';
import { LightSource } from './lightSource.ts';

export type Look = 'fire' | 'post' | 'hand';

export class EmitterKind {
  constructor(
    readonly look: Look,
    readonly heat: HeatSource | null,
    readonly light: LightSource | null,
  ) {}
}

const FLAME = [1, 0.62, 0.3] as const;

export const CAMPFIRE = new EmitterKind('fire', new HeatSource(7, 1), new LightSource(7, 1.35, [1, 0.58, 0.26]));

export const STANDING_TORCH = new EmitterKind('post', new HeatSource(3.5, 0.4), new LightSource(4.5, 1.1, FLAME));

export const HELD_TORCH = new EmitterKind('hand', new HeatSource(2.2, 0.25), new LightSource(3.2, 0.8, FLAME));

export const BURNING_BRANCH = new EmitterKind('hand', new HeatSource(2.6, 0.3), new LightSource(3.6, 0.65, FLAME));

export interface Emitter {
  id: number;
  kind: EmitterKind;
  x: number;
  y: number;
  level: number;
}

const FIRE_IDS = 100_000;

const TORCH_IDS = 200_000;

const HELD_IDS = 300_000;

const LYING_IDS = 400_000;

export const IGNITER_REACH_TILES = 8;

export function emittersIn(world: World, people: People): Emitter[] {
  const { grid } = world;
  const found: Emitter[] = [];

  for (const tile of world.fires) {
    const at = grid.centre(tile);
    found.push({ id: FIRE_IDS + tile, kind: CAMPFIRE, x: at.x, y: at.y, level: fireLevel(world.fuelAt(tile)) });
  }
  for (const tile of world.torches) {
    if (world.isDeepTorch(tile)) continue;
    const at = grid.centre(tile);
    found.push({ id: TORCH_IDS + tile, kind: STANDING_TORCH, x: at.x, y: at.y, level: 1 });
  }
  for (const tile of world.items.burningTiles()) {
    const at = grid.centre(tile);
    found.push({ id: LYING_IDS + tile, kind: BURNING_BRANCH, x: at.x, y: at.y, level: 1 });
  }
  for (let person = 0; person < people.count; person += 1) {
    const held = people.heldItemType[person];
    if (held === ItemType.Torch) found.push({ id: HELD_IDS + person, kind: HELD_TORCH, x: people.posX[person]!, y: people.posY[person]!, level: 1 });
    if (held === ItemType.BurningBranch) found.push({ id: HELD_IDS + person, kind: BURNING_BRANCH, x: people.posX[person]!, y: people.posY[person]!, level: 1 });
  }
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

export function igniterNear(world: World, people: People, x: number, y: number): boolean {
  for (const emitter of emittersIn(world, people)) {
    if (emitter.kind !== CAMPFIRE && emitter.kind !== BURNING_BRANCH) continue;
    if (Math.hypot(emitter.x - x, emitter.y - y) <= IGNITER_REACH_TILES) return true;
  }
  return false;
}
