import type { Vec2 } from '../geometry.ts';
import { landFraction, SEA_LEVEL, WORLD_EXTENT, CAMERA_MARGIN } from './heightmap.ts';
import type { Environment } from '../types.ts';
import type { Biome } from '../types.ts';
import {
  biomeAt as biomeOfField,
  crossesWater as crossesWaterIn,
  environmentAt,
  fieldFor,
  groundAt,
  nearestFreshWater,
  reachesIn,
  waterSheetFor,
} from './worldfield.ts';
import type { WaterSheet } from './worldfield.ts';
export type { WaterSheet };
import type { RiverSegment } from './hydrology.ts';
import type { Bounds } from '../geometry.ts';

export function terrainAt(seed: number, world: Vec2): Environment {
  return environmentAt(fieldFor(seed), world);
}

export function biomeAt(seed: number, world: Vec2): Biome {
  return biomeOfField(fieldFor(seed), world);
}

export function groundBiomeAt(seed: number, world: Vec2): Biome {
  return groundAt(fieldFor(seed), world);
}

export function waterBetween(seed: number, from: Vec2, to: Vec2): boolean {
  return crossesWaterIn(fieldFor(seed), from, to);
}

export function waterSheet(seed: number): WaterSheet {
  return waterSheetFor(fieldFor(seed));
}

export function riverRunsIn(seed: number, bounds: Bounds): RiverSegment[] {
  return reachesIn(fieldFor(seed), bounds);
}

export function nearestWater(seed: number, world: Vec2): Vec2 | null {
  return nearestFreshWater(fieldFor(seed), world);
}

export { landFraction, SEA_LEVEL, WORLD_EXTENT, CAMERA_MARGIN };
