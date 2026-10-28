import { stageSuitability } from '../fauna/habitat/suitability.ts';
import { LIVES, Stage } from '../fauna/life.ts';
import { tileSampler } from '../fauna/patches.ts';
import type { Vec2 } from '../geometry.ts';
import { Biome } from '../types.ts';
import type { World } from '../world.ts';
import type { Passable } from './walker.ts';

const STEP_METRES = 0.5;

export interface Ground {
  suitability(life: number, point: Vec2): number;
  wet(point: Vec2): boolean;
  passable(life: number): Passable;
}

export function groundOf(world: World): Ground {
  const sample = tileSampler(world);
  const { grid } = world;
  const suitability = (life: number, point: Vec2): number => {
    const index = grid.atPoint(point);
    if (index < 0) return 0;
    return stageSuitability(LIVES[life]!, Stage.Adult, sample(grid.columnOf(index), grid.rowOf(index)));
  };
  const wet = (point: Vec2): boolean => {
    const index = grid.atPoint(point);
    return index >= 0 && (world.river[index] === 1 || world.biome[index]! >= Biome.Ocean);
  };
  return {
    suitability,
    wet,
    passable: (life) => (from, to) => {
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const steps = Math.max(1, Math.ceil(length / STEP_METRES));
      for (let step = 1; step <= steps; step += 1) {
        const u = step / steps;
        if (suitability(life, { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u }) <= 0) return false;
      }
      return true;
    },
  };
}
