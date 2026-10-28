import type { Lighting } from '../render/lit/lighting.ts';
import { skyAt } from '../render/lit/lighting.ts';
import { southernSeasonPhaseOf } from '../sim/astro.ts';
import type { CalendarMoment } from '../sim/calendar.ts';
import { placeOf } from '../sim/daylight.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { seasonalStateForBothHemispheres } from '../sim/seasons/seasonalRegistry.ts';
import { FAUNA_COLUMNS, FAUNA_ROWS, LIFE_COUNT } from '../sim/fauna/life.ts';
import type { FaunaMirror } from '../sim/fauna/pack.ts';
import { TEMPERATURE_TEXTURE_FLOOR_CELSIUS, TEMPERATURE_TEXTURE_SPAN_CELSIUS } from '../sim/weather/weatherTextures.ts';
import { SkyMirror } from '../sim/weather/skyView.ts';
import { WeatherGrid } from '../sim/weather/weatherGrid.ts';
import { WEATHER_STEP } from '../sim/terrain/weather.ts';
import type { World } from '../sim/world.ts';

const MILD_CELSIUS = 20;

const MIDDLE = 128;

export function stillSky(world: World): SkyMirror {
  const { weather } = world.field;
  const grid = new WeatherGrid(weather.columns, weather.rows);
  const bytes = (fill: readonly number[]): Uint8Array => Uint8Array.from({ length: grid.cellCount * 4 }, (_, at) => fill[at % 4]!);
  const mild = Math.round(((MILD_CELSIUS - TEMPERATURE_TEXTURE_FLOOR_CELSIUS) / TEMPERATURE_TEXTURE_SPAN_CELSIUS) * 255);
  return new SkyMirror(grid, (column, row) => grid.clampedCellIndex(Math.floor(column / WEATHER_STEP), Math.floor(row / WEATHER_STEP)), {
    precipitationData: bytes([0, 0, 0, 0]),
    cloudData: bytes([0, 0, 0, 0]),
    fieldData: bytes([mild, MIDDLE, MIDDLE, MIDDLE]),
    groundData: bytes([0, 0, 0, 0]),
    vapourData: bytes([0, 0, 0, 0]),
    revision: 1,
    pressureCentres: [],
    recentBolts: [],
    dischargeCount: 0,
    groundStrikeCount: 0,
    latestGroundStrike: { x: 0, y: 0 },
  });
}

export function emptyFauna(): FaunaMirror {
  const columns = FAUNA_COLUMNS;
  const rows = FAUNA_ROWS;
  return { columns, rows, levels: new Uint8Array(LIFE_COUNT * columns * rows * 4), suit: new Uint8Array(LIFE_COUNT * columns * rows * 4), version: 1 };
}

const FULL_MOON = 0.5;

const DRIFT = 1.2;

export const lightingFor = (world: World, centre: Vec2, hour: number, season: number): Lighting => {
  const place = placeOf(world.grid, world.seed, centre);
  const moment: CalendarMoment = { timeOfDay: (((hour - place.offset) % 1) + 1) % 1, seasonPhase: season, moonPhase: FULL_MOON, completedDays: 0 };
  const seasons = seasonalStateForBothHemispheres(season, southernSeasonPhaseOf(season));
  return {
    ...skyAt(moment, place),
    moment,
    seasonalShaderTable: seasons.shaderTable,
    fallingLeaves: seasons.fallingLeaves,
    blowingPetals: seasons.blowingPetals,
    leafLitter: seasons.leafLitter,
    drift: [world.field.prevailing * DRIFT, DRIFT * 0.25],
    wind: 1,
    points: [],
  };
};
