import { sheetAt } from '../modules/client.ts';
import { skyAt } from '../render/lit/lighting.ts';
import { placeOf } from '../sim/daylight.ts';
import { dateName, sunAndMoonBearingsAt, seasonPhaseAtLatitude, seasonName, localSolarTimeOfDay } from '../sim/astro.ts';
import { CLOUD_WATER_CAP } from '../modules/weather/api.ts';
import { FORCED_WEATHER_CHOICES } from '../modules/weather/api.ts';
import { cloudKind, describeWeather, readCell } from '../modules/weather/api.ts';
import { PEAK_METRES } from '../sim/terrain/climate.ts';
import { SEA_LEVEL } from '../sim/terrain/heightmap.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { NOWHERE } from '../sim/grid.ts';
import type { Tile } from '../sim/tile.ts';
import { windName } from '../sim/terrain/wind.ts';
import { ITEM_NAMES } from '../modules/items/api.ts';
import { NOBODY } from '../modules/people/api.ts';
import { personView } from './personView.ts';
import type { Arrival, Game, HudSnapshot, TileView } from './game.ts';
import { newIdea } from './mindActions.ts';

export function debugView(game: Game): string {
  const { centre } = game.camera;
  const place = placeOf(game.world.grid, game.world.seed, centre);
  return JSON.stringify({
    seed: game.world.seed,
    mode: game.mode,
    x: Number(centre.x.toFixed(3)),
    y: Number(centre.y.toFixed(3)),
    zoom: Number(game.zoom.toFixed(3)),
    calendar: game.replica.calendar.state(),
    forced: game.replica.forced,
    localTime: game.localLabel(),
    latitude: Number(place.latitude.toFixed(2)),
  });
}

export function groundItems(game: Game, tile: Tile): string | null {
  const { items } = game.world;
  const kinds = items.kindsAt(tile.index);
  if (kinds.length === 0) return null;
  return kinds.map((kind) => `${items.tally(tile.index, kind)} ${ITEM_NAMES[kind]}`).join(', ');
}

export function seasonHere(game: Game): string {
  const { world } = game;
  return seasonName(seasonPhaseAtLatitude(game.season, placeOf(world.grid, world.seed, game.camera.centre).latitude));
}

export function weatherHere(game: Game): string {
  const forced = FORCED_WEATHER_CHOICES[game.replica.forced];
  const here = describeWeatherAt(game, game.camera.centre);
  return forced ? `${here} (${forced})` : here;
}

export function cellAt(game: Game, point: Vec2): number {
  const { grid } = game.world;
  return game.sky.cellContainingTile(grid.column(point.x), grid.row(point.y));
}

export function describeWeatherAt(game: Game, point: Vec2): string {
  return describeWeather(readCell(game.sky, cellAt(game, point)));
}

export function readout(game: Game, tile: Tile): readonly (readonly [string, string])[] {
  const { world, sky } = game;
  const cell = sky.cellContainingTile(tile.column, tile.row);
  const air = readCell(sky, cell);
  const weather = world.field.weather;
  const metres = ((tile.elevation - SEA_LEVEL) / (1 - SEA_LEVEL)) * PEAK_METRES;
  const percent = (value: number): string => `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
  const brightness = (colour: readonly [number, number, number]): number => (colour[0] + colour[1] + colour[2]) / 3;

  const place = placeOf(world.grid, world.seed, tile.centre);
  const lights = skyAt(game.moment, place);
  const heavens = sunAndMoonBearingsAt(place.latitude, localSolarTimeOfDay(game.clock, place.offset), game.season, game.moon);
  const degrees = (up: number): string => `${Math.round((Math.asin(Math.min(1, Math.max(-1, up))) * 180) / Math.PI)} deg`;
  const localMinutes = Math.floor(localSolarTimeOfDay(game.clock, place.offset) * 1440);
  const localTime = `${String(Math.floor(localMinutes / 60)).padStart(2, '0')}:${String(localMinutes % 60).padStart(2, '0')}`;
  const front = air.overcast;
  const level =
    brightness(lights.sun) * (1 - 0.75 * front) + brightness(lights.moon) + brightness(lights.ambient) * (1 - 0.3 * front);

  const speed = air.windSpeed;
  const humidity = weather.humid[cell]! * 0.7 + air.wetness * 0.2 + air.rain * 0.3;
  const here = describeWeather(air);
  const forced = FORCED_WEATHER_CHOICES[game.replica.forced];

  const lying = groundItems(game, tile);

  return [
    ...(lying ? ([['on the ground', lying]] as const) : []),
    ['height', `${Math.round(metres)} m`],
    ['temperature', `${air.temperature.toFixed(1)} C`],
    ['weather', forced ? `${here} (${forced})` : here],
    ['cloud', cloudKind(air)],
    ['cloud water', percent(air.cloudWater / CLOUD_WATER_CAP)],
    ['vapour', percent(air.vapour)],
    ['storm front', percent(front)],
    ['wind', `${speed.toFixed(1)} m/s, ${windName(tile.wind)}`],
    ['pressure', `${Math.round(1013 + air.pressure * 9)} hPa`],
    ['humidity', percent(humidity)],
    ['rain', percent(air.rain)],
    ['snowfall', percent(air.snowfall)],
    ['dust', percent(air.dust)],
    ['snow cover', percent(air.snowCover)],
    ['wet ground', percent(air.wetness)],
    ['fog chance', percent(weather.data[cell * 4]! / 255)],
    ['light', percent(level / 1.55)],
    ['local time', localTime],
    ['sun', degrees(heavens.sun.up)],
    ['moon', degrees(heavens.moon.up)],
    ['season', seasonName(seasonPhaseAtLatitude(game.season, place.latitude))],
    ['date', dateName(game.season)],
    ['time', game.clockLabel()],
  ];
}

export function viewOf(game: Game, tile: Tile): TileView {
  return {
    index: tile.index,
    column: tile.column,
    row: tile.row,
    centre: tile.centre,
    biome: tile.name,
    standing: tile.standing,
    elevation: tile.elevation,
    wear: tile.wear,
    readout: readout(game, tile),
    walkable: tile.walkable,
    refusal: tile.refusal,
  };
}

export function buildSnapshot(game: Game): HudSnapshot {
  const opened = game.tile(game.openedIndex);

  return {
    detail: game.detail(),
    day: game.speed > 0,
    dayFraction: game.localDay(),
    structure: game.selectedStructure === NOWHERE ? null : sheetAt({ world: game.world, people: game.people, mind: game.replica.mind }, game.selectedStructure),
    person: game.selectedPerson === NOBODY ? null : personView(game.people, game.selectedPerson, game.thoughtsOf(game.selectedPerson)),
    announcement: game.toast
      ? { id: game.toast.id, title: game.toast.title, reason: game.toast.reason, unlocks: game.toast.unlocks }
      : null,
    speed: game.speed,
    trial: game.trial !== null,
    mind: game.replica.mind,
    mindOpen: game.mindOpen,
    menu: game.menu,
    forming: newIdea(game),
    brain: arrival(game, 'idea'),
    dial: arrival(game, 'light'),
    opened: opened ? viewOf(game, opened) : null,
    tiles: game.world.count,
  };
}

function arrival(game: Game, id: string): Arrival {
  if (game.arrived.has(id)) return 'arriving';
  return game.mode === 'discover' || game.replica.achievements.includes(id) ? 'shown' : null;
}
