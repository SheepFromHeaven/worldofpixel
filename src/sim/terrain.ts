import { boundsOf } from './geometry.ts';
import type { Vec2 } from './geometry.ts';
import { landFraction, SEA_LEVEL, WORLD_EXTENT, WORLD_MARGIN } from './heightmap.ts';
import type { Environment } from './types.ts';
import type { Biome } from './types.ts';
import {
  biomeAt as biomeOfField,
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
 * Where a map sits in world coordinates. Every layer draws its own canvas in local units, but
 * the land underneath is one continuous field: `world = origin + local / scale`. A region is the
 * same ground as the world cell that contains it, read at five times the magnification, which is
 * the only way a lake can appear in both views and be the same lake.
 */
export interface Frame {
  origin: Vec2;
  scale: number;
}

export const WORLD_FRAME: Frame = { origin: { x: 0, y: 0 }, scale: 1 };

export const toWorld = (frame: Frame, local: Vec2): Vec2 => ({
  x: frame.origin.x + local.x / frame.scale,
  y: frame.origin.y + local.y / frame.scale,
});

export const toLocal = (frame: Frame, world: Vec2): Vec2 => ({
  x: (world.x - frame.origin.x) * frame.scale,
  y: (world.y - frame.origin.y) * frame.scale,
});

/** A frame that blows a parent's outline up to fill a child canvas, with a little air around it. */
export function frameFor(
  parent: Frame,
  outlineLocal: readonly Vec2[],
  canvas: { width: number; height: number },
  margin = 0.9,
): Frame {
  const bounds = boundsOf(outlineLocal.map((point) => toWorld(parent, point)));
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(canvas.width / width, canvas.height / height) * margin;

  return {
    origin: {
      x: (bounds.minX + bounds.maxX) / 2 - canvas.width / (2 * scale),
      y: (bounds.minY + bounds.maxY) / 2 - canvas.height / (2 * scale),
    },
    scale,
  };
}

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

/** The average of several samples — what a whole territory counts as, rather than one point. */
export function averageTerrain(samples: readonly Environment[]): Environment {
  if (samples.length === 0) return { elevation: 0.5, temperature: 0.5, humidity: 0.5 };
  const sum = samples.reduce(
    (total, sample) => ({
      elevation: total.elevation + sample.elevation,
      temperature: total.temperature + sample.temperature,
      humidity: total.humidity + sample.humidity,
    }),
    { elevation: 0, temperature: 0, humidity: 0 },
  );
  return {
    elevation: sum.elevation / samples.length,
    temperature: sum.temperature / samples.length,
    humidity: sum.humidity / samples.length,
  };
}
