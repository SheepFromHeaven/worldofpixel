import type { Vec2 } from '../geometry.ts';
import type { Environment } from '../types.ts';
import type { Biome } from '../types.ts';
import { CAMERA_MARGIN, landFraction, SEA_LEVEL, WORLD_EXTENT } from './heightmap.ts';
import { biomeAt, environmentAt, fieldFor, groundAt } from './worldfield.ts';

export const terrainAt = (seed: number, point: Vec2): Environment =>
  environmentAt(fieldFor(seed), point);

export const biomeOf = (seed: number, point: Vec2): Biome => biomeAt(fieldFor(seed), point);

export const groundBiomeOf = (seed: number, point: Vec2): Biome => groundAt(fieldFor(seed), point);

const MIN_LAND = 0.15;

export function rollSeed(random: () => number): number {
  for (let tries = 0; tries < 24; tries += 1) {
    const seed = Math.floor(random() * 0x7fffffff);
    if (landFraction(seed) >= MIN_LAND) return seed;
  }
  return Math.floor(random() * 0x7fffffff);
}

export { CAMERA_MARGIN, landFraction, SEA_LEVEL, WORLD_EXTENT };
