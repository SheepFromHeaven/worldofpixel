import type { Bounds, Vec2 } from '../geometry.ts';
import type { Biome, Environment } from '../types.ts';
import { CAMERA_MARGIN, landFraction, SEA_LEVEL, WORLD_EXTENT } from './heightmap.ts';
import type { RiverSegment } from './hydrology.ts';
import type { WaterSheet } from './worldfield.ts';
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
export type { WaterSheet };

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

export { CAMERA_MARGIN,landFraction,SEA_LEVEL,WORLD_EXTENT };
