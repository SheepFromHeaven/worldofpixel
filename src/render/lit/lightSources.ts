import type { Vec2 } from '../../sim/geometry.ts';
import type { People } from '../../sim/people/people.ts';
import { emittersIn } from '../../sim/sources/emitters.ts';
import { reachScale } from '../../sim/sources/fuel.ts';
import type { World } from '../../sim/world.ts';
import type { PointLight } from './lighting.ts';
import { MAX_POINTS } from './lighting.ts';
import { TORCH_FLAME_LIFT_TILES } from './litLayerConstants.ts';

const CAMPFIRE_WIND_SHARE = 0.5;

export function lightSourcesOf(world: World, people: People, centre: Vec2, windAt: (x: number, y: number) => number): PointLight[] {
  const lit: PointLight[] = [];
  for (const { id, kind, x, y, level } of emittersIn(world, people)) {
    const { light } = kind;
    if (!light) continue;
    const exposed = kind.look === 'fire' ? CAMPFIRE_WIND_SHARE : 1;
    lit.push({ id, x, y: kind.look === 'post' ? y - TORCH_FLAME_LIFT_TILES : y, reach: light.reach * reachScale(level), strength: light.strength * level, color: light.colour, wind: windAt(x, y) * exposed, ...(kind.look === 'post' ? {} : { source: kind.look }) });
  }
  if (lit.length <= MAX_POINTS) return lit;
  const away = (light: PointLight): number => Math.hypot(light.x - centre.x, light.y - centre.y);
  return lit.sort((a, b) => away(a) - away(b)).slice(0, MAX_POINTS);
}
