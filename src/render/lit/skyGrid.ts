import { dayFractionOffsetAtMapPosition } from '../../sim/astro.ts';
import { latitudeAt, latitudesOf } from '../../sim/terrain/climate.ts';
import type { Vec2 } from '../../sim/geometry.ts';
import type { FieldGrid } from '../../sim/terrain/heightmap.ts';
import { cellY, WORLD_EXTENT } from '../../sim/terrain/heightmap.ts';
import type { CalendarMoment } from '../../sim/calendar.ts';
import type { Place, SkyLight } from './lighting.ts';
import { skyAt } from './lighting.ts';

export const SKY_COLUMNS = 64;
export const SKY_ROWS = 48;
export const SKY_SLOTS = 7;

export const SKY_WIDTH = SKY_COLUMNS * SKY_SLOTS;

export const skyBuffer = (): Float32Array => new Float32Array(SKY_WIDTH * SKY_ROWS * 4);

const slots = (sky: SkyLight): readonly (readonly [number, number, number, number])[] => [
  [sky.toward[0], sky.toward[1], sky.toward[2], sky.daylight],
  [sky.sun[0], sky.sun[1], sky.sun[2], sky.sunShadow],
  [sky.moonToward[0], sky.moonToward[1], sky.moonToward[2], sky.moonShadow],
  [sky.moon[0], sky.moon[1], sky.moon[2], sky.gloom],
  [sky.ambient[0], sky.ambient[1], sky.ambient[2], sky.fog],
  [sky.fogColor[0], sky.fogColor[1], sky.fogColor[2], 0],
  [sky.cloudColor[0], sky.cloudColor[1], sky.cloudColor[2], 0],
];

export function fillSky(out: Float32Array, grid: FieldGrid, seed: number, moment: CalendarMoment): void {
  const latitudes = latitudesOf(seed);
  for (let row = 0; row < SKY_ROWS; row += 1) {
    const latitude = latitudeAt(latitudes, cellY(grid, Math.min(grid.rows - 1, Math.floor(((row + 0.5) / SKY_ROWS) * grid.rows))));
    for (let column = 0; column < SKY_COLUMNS; column += 1) {
      const sky = skyAt(moment, { latitude, offset: dayFractionOffsetAtMapPosition((column + 0.5) / SKY_COLUMNS) });
      slots(sky).forEach((values, slot) => {
        out.set(values, ((row * SKY_COLUMNS * SKY_SLOTS) + slot * SKY_COLUMNS + column) * 4);
      });
    }
  }
}

export function skyPeaks(data: Float32Array): { sun: number; moon: number } {
  let sun = 0;
  let moon = 0;
  for (let row = 0; row < SKY_ROWS; row += 1) {
    for (let column = 0; column < SKY_COLUMNS; column += 1) {
      const sunAt = ((row * SKY_COLUMNS * SKY_SLOTS) + SKY_COLUMNS + column) * 4 + 3;
      const moonAt = ((row * SKY_COLUMNS * SKY_SLOTS) + 2 * SKY_COLUMNS + column) * 4 + 3;
      sun = Math.max(sun, data[sunAt]!);
      moon = Math.max(moon, data[moonAt]!);
    }
  }
  return { sun, moon };
}

export function placeOf(grid: FieldGrid, seed: number, point: Vec2): Place {
  const across = (point.x - grid.minX) / (grid.columns * grid.spacing);
  return { latitude: latitudeAt(latitudesOf(seed), point.y), offset: dayFractionOffsetAtMapPosition(Math.min(1, Math.max(0, across))) };
}

export function latitudeSpan(seed: number): readonly [number, number, number] {
  const { north, south } = latitudesOf(seed);
  return [north, south, WORLD_EXTENT.height];
}
