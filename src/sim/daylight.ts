import type { Bearing } from './astro.ts';
import { dayFractionOffsetAtMapPosition, localSolarTimeOfDay, sunAndMoonBearingsAt } from './astro.ts';
import type { CalendarMoment } from './calendar.ts';
import type { Vec2 } from './geometry.ts';
import { latitudeAt, latitudesOf } from './terrain/climate.ts';
import type { FieldGrid } from './terrain/heightmap.ts';

export interface Place {
  latitude: number;
  offset: number;
}

export interface Daylight {
  clock: number;
  sun: Bearing;
  moon: Bearing;
  daylight: number;
  moonLight: number;
  gloom: number;
}

export const smooth = (edge0: number, edge1: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export function placeOf(grid: FieldGrid, seed: number, point: Vec2): Place {
  const across = (point.x - grid.minX) / (grid.columns * grid.spacing);
  return { latitude: latitudeAt(latitudesOf(seed), point.y), offset: dayFractionOffsetAtMapPosition(Math.min(1, Math.max(0, across))) };
}

export function daylightAt(moment: CalendarMoment, place: Place): Daylight {
  const clock = localSolarTimeOfDay(moment.timeOfDay, place.offset);
  const { sun, moon } = sunAndMoonBearingsAt(place.latitude, clock, moment.seasonPhase, moment.moonPhase);
  const daylight = smooth(-0.03, 0.2, sun.up);
  const illumination = 0.5 - 0.5 * Math.cos(2 * Math.PI * moment.moonPhase);
  const moonLight = smooth(-0.02, 0.2, moon.up) * illumination;
  return {
    clock,
    sun,
    moon,
    daylight,
    moonLight,
    gloom: (1 - daylight) * (0.74 - 0.3 * moonLight),
  };
}
