import type { Vec2 } from './geometry.ts';
import { landFraction, SEA_LEVEL, WORLD_EXTENT, WORLD_MARGIN } from './heightmap.ts';
import type { Environment } from './types.ts';
import type { Biome } from './types.ts';
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
import type { Bounds } from './geometry.ts';

/**
 * One field in world coordinates that every tier samples, and the only way in to it.
 *
 * The world behind this is built once per seed — see `worldfield.ts`, which says why it has to
 * be — but nothing outside needs to know that. Ask what is at a point and you get the answer,
 * the same answer, at every zoom and in every part of the program.
 */
export function terrainAt(seed: number, world: Vec2): Environment {
  return environmentAt(fieldFor(seed), world);
}

/** What is standing at a point: the sea, a lake, a river, or the ground the weather made. */
export function biomeAt(seed: number, world: Vec2): Biome {
  return biomeOfField(fieldFor(seed), world);
}

/** The ground under a point with the rivers taken off it — what the painter fills a cell with. */
export function groundBiomeAt(seed: number, world: Vec2): Biome {
  return groundAt(fieldFor(seed), world);
}

/** Whether water lies anywhere along the straight line between two points. */
export function waterBetween(seed: number, from: Vec2, to: Vec2): boolean {
  return crossesWaterIn(fieldFor(seed), from, to);
}

/** The world's standing water, for whoever is painting a lot of it. See `WaterSheet`. */
export function waterSheet(seed: number): WaterSheet {
  return waterSheetFor(fieldFor(seed));
}

/** Every run of river that could reach into a rectangle, for whoever is drawing that rectangle. */
export function riverRunsIn(seed: number, bounds: Bounds): RiverSegment[] {
  return reachesIn(fieldFor(seed), bounds);
}

/** The nearest river or lake to a point. The sea is not fresh water, and is never the answer. */
export function nearestWater(seed: number, world: Vec2): Vec2 | null {
  return nearestFreshWater(fieldFor(seed), world);
}

export { landFraction, SEA_LEVEL, WORLD_EXTENT, WORLD_MARGIN };
