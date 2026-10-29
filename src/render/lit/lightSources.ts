import type { Vec2 } from '../../sim/geometry.ts';
import type { People } from '../../sim/people/people.ts';
import { GAME_EMITTERS } from '../../sim/modules/index.ts';
import { gather } from '../../sim/sources/emitters.ts';
import { reachScale } from '../../sim/sources/fuel.ts';
import type { World } from '../../sim/world.ts';
import type { PointLight } from './lighting.ts';
import { MAX_POINTS } from './lighting.ts';

export function lightSourcesOf(world: World, people: People, centre: Vec2, windAt: (x: number, y: number) => number): PointLight[] {
  const lit: PointLight[] = [];
  for (const { id, kind, x, y, level } of gather(GAME_EMITTERS, world, people)) {
    const { light } = kind;
    if (!light) continue;
    const { behaviour } = light;
    lit.push({ id, x, y: y - behaviour.lift, reach: light.reach * reachScale(level), strength: light.strength * level, color: light.colour, look: kind.look, flame: behaviour.flame, flicker: behaviour.flicker, lift: behaviour.lift, wind: windAt(x, y) * behaviour.windShare });
  }
  if (lit.length <= MAX_POINTS) return lit;
  const away = (light: PointLight): number => Math.hypot(light.x - centre.x, light.y - centre.y);
  return lit.sort((a, b) => away(a) - away(b)).slice(0, MAX_POINTS);
}
