import { emittersIn } from '../sources/emitters.ts';
import type { World } from '../world.ts';
import type { LightSpot, People } from './people.ts';

const LIGHT_SEEK_TILES = 60;
const SLEEP_BY_FIRE_TILES = 2.2;
const SLEEP_BY_TORCH_TILES = 1.2;

export function lightSpotNear(world: World, people: People, x: number, y: number): LightSpot | null {
  let found: LightSpot | null = null;
  let least = LIGHT_SEEK_TILES;
  for (const { kind, x: lx, y: ly } of emittersIn(world, people)) {
    if (!kind.light || kind.look === 'hand') continue;
    const away = Math.hypot(lx - x, ly - y);
    if (away < least) {
      least = away;
      found = { x: lx, y: ly, side: kind.look === 'fire' ? SLEEP_BY_FIRE_TILES : SLEEP_BY_TORCH_TILES };
    }
  }
  return found;
}
