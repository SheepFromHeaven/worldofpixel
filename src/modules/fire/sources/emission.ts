import type { LightSpot, People } from '../../people/api.ts';
import type { World } from '../../../sim/world.ts';
import type { Emitter, EmitterSource } from './emitters.ts';
import { gather, igniterIn, warmthFrom } from './emitters.ts';

const LIGHT_SEEK_TILES = 60;
const SLEEP_BY_FIRE_TILES = 2.2;
const SLEEP_BY_TORCH_TILES = 1.2;

export class Emission {
  constructor(
    private readonly sources: readonly EmitterSource[],
    private readonly world: World,
    private readonly people: People,
  ) {}

  all(): Emitter[] {
    return gather(this.sources, this.world, this.people);
  }

  warmthAt(x: number, y: number): number {
    return warmthFrom(this.all(), x, y);
  }

  igniterNear(x: number, y: number): boolean {
    return igniterIn(this.all(), x, y);
  }

  lightSpotNear(x: number, y: number): LightSpot | null {
    let found: LightSpot | null = null;
    let least = LIGHT_SEEK_TILES;
    for (const { kind, x: lx, y: ly } of this.all()) {
      if (!kind.light || kind.look === 'hand') continue;
      const away = Math.hypot(lx - x, ly - y);
      if (away < least) {
        least = away;
        found = { x: lx, y: ly, side: kind.look === 'fire' ? SLEEP_BY_FIRE_TILES : SLEEP_BY_TORCH_TILES };
      }
    }
    return found;
  }
}
