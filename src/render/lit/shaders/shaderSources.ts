import { CLIFF_SEEN } from '../../../sim/steep.ts';
import { FASTEST_FLOW } from '../../../sim/aquatic.ts';
import { FAUNA_ATLAS_ACROSS, FAUNA_ATLAS_DOWN, FAUNA_COLUMNS, FAUNA_ROWS, PATCH_AREA } from '../../../modules/fauna/api.ts';
import { FILL_SCALE, LEVEL_LOG_MAX, LEVEL_LOG_MIN } from '../../../modules/fauna/api.ts';
import { DAY_SECONDS, YEAR_LENGTH_IN_GAME_DAYS } from '../../../sim/calendar.ts';
import { CLICK_MEMORY, FRESH_WATER_FROM, SNOW_FROM, SNOW_TO, WATER_FLAG, WET_FROM, WET_TO } from '../../../modules/fauna/api.ts';
import { SIGHT_BIGGEST_METRES, SIGHT_FADE_LEVELS, SIGHT_FARTHEST_ZOOM, SIGHT_NEAREST_ZOOM } from '../animalSight.ts';
import { FLAME_RAMP_STEPS } from '../flames.ts';
import { MAX_POINTS } from '../lighting.ts';
import { ZOO_LEGS } from '../zoo.ts';
import { LAYERED_FLAG, LIFTED_DEPTH_PER_TILE, MAX_VISIBLE_BOLTS, PROP_DEPTH_RANGE, SEE_THROUGH_DEPTH, SEE_THROUGH_FOCI, SEE_THROUGH_GAIN, SEE_THROUGH_LEAF_BAND, SEE_THROUGH_OUTER, SEE_THROUGH_REVEAL_BIAS, SEE_THROUGH_RISE_BAND, SEE_THROUGH_WOOD_BAND, STEM_FLAG, SUBMERGED_FLAG, TALL_MARK_HEIGHT } from '../litLayerConstants.ts';
import { SKY_COLUMNS, SKY_ROWS, SKY_WIDTH } from '../skyGrid.ts';
import {
  PRESSURE_TEXTURE_RANGE,
  TEMPERATURE_TEXTURE_FLOOR_CELSIUS,
  TEMPERATURE_TEXTURE_SPAN_CELSIUS,
  WIND_TEXTURE_RANGE_METRES_PER_SECOND,
} from '../../../modules/weather/api.ts';
import fogFragment from './fog.frag?raw';
import fullScreenQuadVertex from './fullScreenQuad.vert?raw';
import groundGradeFragment from './groundGrade.frag?raw';
import lakeAndSeaFragment from './lakeAndSea.frag?raw';
import mapViewFragment from './mapView.frag?raw';
import propFragment from './propShader.frag?raw';
import propVertex from './propShader.vert?raw';
import riverFragment from './river.frag?raw';
import terrainCoarseFragment from './terrainCoarse.frag?raw';
import terrainLibrary from './terrain.glsl?raw';
import terrainLightFragment from './terrainLight.frag?raw';
import skyPlacesLibrary from './skyPlaces.glsl?raw';
import waterCommonLibrary from './waterCommon.glsl?raw';
import faunaLibrary from './fauna.glsl?raw';
import { ANIMAL_SHADERS, animalLibraries, animalViewShader } from '../../../content/animals/registry.ts';
import zooLibrary from './zoo.glsl?raw';
import weatherLibrary from './weatherLibrary.glsl?raw';

export const MAX_WATER_POKES = 4;

const LIBRARIES: Record<string, string> = {
  'fauna.glsl': faunaLibrary,
  'skyPlaces.glsl': skyPlacesLibrary,
  'terrain.glsl': terrainLibrary,
  'waterCommon.glsl': waterCommonLibrary,
  ...animalLibraries(),
  'zoo.glsl': zooLibrary,
  'weatherLibrary.glsl': weatherLibrary,
};

export const registerShaderLibrary = (name: string, source: string): void => {
  if (LIBRARIES[name] !== undefined) throw new Error(`two shader libraries are called ${name}`);
  LIBRARIES[name] = source;
};

export const asFloatLiteral = (value: number): string => (Number.isInteger(value) ? `${value}.0` : `${value}`);

const DEFINES: readonly (readonly [string, string])[] = [
  ['MAX_POINTS', `${MAX_POINTS}`],
  ['RAMP_STEPS', `${FLAME_RAMP_STEPS}`],
  ['SIGHT_BIGGEST_METRES', asFloatLiteral(SIGHT_BIGGEST_METRES)],
  ['SIGHT_NEAREST_ZOOM', asFloatLiteral(SIGHT_NEAREST_ZOOM)],
  ['SIGHT_FARTHEST_ZOOM', asFloatLiteral(SIGHT_FARTHEST_ZOOM)],
  ['SIGHT_FADE_LEVELS', asFloatLiteral(SIGHT_FADE_LEVELS)],
  ['PROP_DEPTH_RANGE', asFloatLiteral(PROP_DEPTH_RANGE)],
  ['CLICKS', `${CLICK_MEMORY}`],
  ['ZOO_LEGS', `${ZOO_LEGS}`],
  ['WATER_FLAG', asFloatLiteral(WATER_FLAG)],
  ['RIVER_FLOW_RANGE', asFloatLiteral(FASTEST_FLOW)],
  ['CLIFF_SEEN', asFloatLiteral(CLIFF_SEEN)],
  ['WET_FROM', asFloatLiteral(WET_FROM)],
  ['WET_TO', asFloatLiteral(WET_TO)],
  ['SNOW_FROM', asFloatLiteral(SNOW_FROM)],
  ['SNOW_TO', asFloatLiteral(SNOW_TO)],
  ['YEAR_SECONDS', asFloatLiteral(YEAR_LENGTH_IN_GAME_DAYS * DAY_SECONDS)],
  ['FRESH_FROM', asFloatLiteral(FRESH_WATER_FROM)],
  ['FAUNA_ATLAS_ACROSS', `${FAUNA_ATLAS_ACROSS}`],
  ['FAUNA_ATLAS_ACROSS_F', asFloatLiteral(FAUNA_ATLAS_ACROSS)],
  ['FAUNA_ATLAS_DOWN_F', asFloatLiteral(FAUNA_ATLAS_DOWN)],
  ['FAUNA_COLUMNS', asFloatLiteral(FAUNA_COLUMNS)],
  ['FAUNA_ROWS', asFloatLiteral(FAUNA_ROWS)],
  ['FAUNA_FILL_SCALE', asFloatLiteral(FILL_SCALE)],
  ['FAUNA_LOG_MIN', asFloatLiteral(LEVEL_LOG_MIN)],
  ['FAUNA_LOG_MAX', asFloatLiteral(LEVEL_LOG_MAX)],
  ['FAUNA_PATCH_AREA', asFloatLiteral(PATCH_AREA)],
  ['MAX_VISIBLE_BOLTS', `${MAX_VISIBLE_BOLTS}`],
  ['MAX_POKES', `${MAX_WATER_POKES}`],
  ['SKY_COLUMNS', asFloatLiteral(SKY_COLUMNS)],
  ['SKY_ROWS', asFloatLiteral(SKY_ROWS)],
  ['SKY_WIDTH', asFloatLiteral(SKY_WIDTH)],
  ['WIND_TEXTURE_RANGE_METRES_PER_SECOND', asFloatLiteral(WIND_TEXTURE_RANGE_METRES_PER_SECOND)],
  ['LIFTED_DEPTH_PER_TILE', asFloatLiteral(LIFTED_DEPTH_PER_TILE)],
  ['STEM_FLAG', asFloatLiteral(STEM_FLAG)],
  ['LAYERED_FLAG', asFloatLiteral(LAYERED_FLAG)],
  ['SUBMERGED_FLAG', asFloatLiteral(SUBMERGED_FLAG)],
  ['SEE_THROUGH', `${SEE_THROUGH_FOCI}`],
  ['SEE_THROUGH_GAIN', asFloatLiteral(SEE_THROUGH_GAIN)],
  ['SEE_THROUGH_LEAF_BAND', asFloatLiteral(SEE_THROUGH_LEAF_BAND)],
  ['SEE_THROUGH_REVEAL_BIAS', asFloatLiteral(SEE_THROUGH_REVEAL_BIAS)],
  ['SEE_THROUGH_WOOD_BAND', asFloatLiteral(SEE_THROUGH_WOOD_BAND)],
  ['SEE_THROUGH_DEPTH', asFloatLiteral(SEE_THROUGH_DEPTH)],
  ['SEE_THROUGH_RISE_BAND', asFloatLiteral(SEE_THROUGH_RISE_BAND)],
  ['SEE_THROUGH_OUTER', asFloatLiteral(SEE_THROUGH_OUTER)],
  ['TALL_MARK_HEIGHT', asFloatLiteral(TALL_MARK_HEIGHT)],
  ['PRESSURE_TEXTURE_RANGE', asFloatLiteral(PRESSURE_TEXTURE_RANGE)],
  ['TEMPERATURE_TEXTURE_FLOOR_CELSIUS', asFloatLiteral(TEMPERATURE_TEXTURE_FLOOR_CELSIUS)],
  ['TEMPERATURE_TEXTURE_SPAN_CELSIUS', asFloatLiteral(TEMPERATURE_TEXTURE_SPAN_CELSIUS)],
];

function expandIncludes(source: string): string {
  return source.replace(/^#include "([^"]+)"\s*$/gm, (_line, libraryName: string) => {
    const library = LIBRARIES[libraryName];
    if (library === undefined) throw new Error(`shader includes unknown library ${libraryName}`);
    return expandIncludes(library);
  });
}

export function assembleShader(source: string, extra: readonly (readonly [string, string])[] = []): string {
  const expanded = expandIncludes(source);
  const firstLineEnd = expanded.indexOf('\n');
  const versionLine = expanded.slice(0, firstLineEnd);
  if (!versionLine.startsWith('#version')) throw new Error('a shader must start with its #version line');
  const defines = [...DEFINES, ...extra].map(([name, value]) => `#define ${name} ${value}`).join('\n');
  return `${versionLine}\n${defines}\n${expanded.slice(firstLineEnd + 1)}`;
}

export const PROP_VERTEX_SHADER = assembleShader(propVertex);
export const PROP_FRAGMENT_SHADER = assembleShader(propFragment);
export const FULL_SCREEN_QUAD_VERTEX_SHADER = assembleShader(fullScreenQuadVertex);
export const FOG_FRAGMENT_SHADER = assembleShader(fogFragment);
export const GROUND_GRADE_FRAGMENT_SHADER = assembleShader(groundGradeFragment);
export const TERRAIN_COARSE_FRAGMENT_SHADER = assembleShader(terrainCoarseFragment);
export const TERRAIN_LIGHT_FRAGMENT_SHADER = assembleShader(terrainLightFragment);
export const MAP_VIEW_FRAGMENT_SHADER = assembleShader(mapViewFragment);
export const RIVER_FRAGMENT_SHADER = assembleShader(riverFragment);
export const LAKE_AND_SEA_FRAGMENT_SHADER = assembleShader(lakeAndSeaFragment);

export const ANIMAL_VIEW_SHADERS: Readonly<Record<string, string>> = Object.fromEntries(ANIMAL_SHADERS.map((one) => [one.key, assembleShader(animalViewShader(one))]));
