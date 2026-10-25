import { INSECT_CELL_TILES, INSECT_COUNT, INSECT_SLOTS, INSECT_CLICKS, WIND_SHELTER } from '../../../sim/insects/species.ts';
import { MAX_POINTS } from '../lighting.ts';
import { MAX_VISIBLE_BOLTS } from '../litLayerConstants.ts';
import { SKY_COLUMNS, SKY_ROWS, SKY_WIDTH } from '../skyGrid.ts';
import {
  PRESSURE_TEXTURE_RANGE,
  TEMPERATURE_TEXTURE_FLOOR_CELSIUS,
  TEMPERATURE_TEXTURE_SPAN_CELSIUS,
  WIND_TEXTURE_RANGE_METRES_PER_SECOND,
} from '../../../sim/weather/weatherTextures.ts';
import cloudsAndLightningFragment from './cloudsAndLightning.frag?raw';
import fallingLeavesFragment from './fallingLeaves.frag?raw';
import fallingLeavesVertex from './fallingLeaves.vert?raw';
import fishFragment from './fish.frag?raw';
import fishVertex from './fish.vert?raw';
import fogFragment from './fog.frag?raw';
import fullScreenQuadVertex from './fullScreenQuad.vert?raw';
import groundGradeFragment from './groundGrade.frag?raw';
import insectsFragment from './insects.frag?raw';
import insectsVertex from './insects.vert?raw';
import lakeAndSeaFragment from './lakeAndSea.frag?raw';
import mapViewFragment from './mapView.frag?raw';
import precipitationFragment from './precipitation.frag?raw';
import propFragment from './propShader.frag?raw';
import propVertex from './propShader.vert?raw';
import riverFragment from './river.frag?raw';
import riverVertex from './river.vert?raw';
import skyPlacesLibrary from './skyPlaces.glsl?raw';
import waterCommonLibrary from './waterCommon.glsl?raw';
import weatherLibrary from './weatherLibrary.glsl?raw';

export const MAX_WATER_POKES = 4;

const LIBRARIES: Readonly<Record<string, string>> = {
  'skyPlaces.glsl': skyPlacesLibrary,
  'waterCommon.glsl': waterCommonLibrary,
  'weatherLibrary.glsl': weatherLibrary,
};

const asFloatLiteral = (value: number): string => (Number.isInteger(value) ? `${value}.0` : `${value}`);

const DEFINES: readonly (readonly [string, string])[] = [
  ['MAX_POINTS', `${MAX_POINTS}`],
  ['INSECT_SPECIES', `${INSECT_COUNT}`],
  ['CLICKS', `${INSECT_CLICKS}`],
  ['INSECT_SLOTS', `${INSECT_SLOTS.length}`],
  ['INSECT_CELL', `${INSECT_CELL_TILES}`],
  ['INSECT_SHELTER', asFloatLiteral(WIND_SHELTER)],
  ['MAX_VISIBLE_BOLTS', `${MAX_VISIBLE_BOLTS}`],
  ['MAX_POKES', `${MAX_WATER_POKES}`],
  ['SKY_COLUMNS', asFloatLiteral(SKY_COLUMNS)],
  ['SKY_ROWS', asFloatLiteral(SKY_ROWS)],
  ['SKY_WIDTH', asFloatLiteral(SKY_WIDTH)],
  ['WIND_TEXTURE_RANGE_METRES_PER_SECOND', asFloatLiteral(WIND_TEXTURE_RANGE_METRES_PER_SECOND)],
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

function assembleShader(source: string): string {
  const expanded = expandIncludes(source);
  const firstLineEnd = expanded.indexOf('\n');
  const versionLine = expanded.slice(0, firstLineEnd);
  if (!versionLine.startsWith('#version')) throw new Error('a shader must start with its #version line');
  const defines = DEFINES.map(([name, value]) => `#define ${name} ${value}`).join('\n');
  return `${versionLine}\n${defines}\n${expanded.slice(firstLineEnd + 1)}`;
}

export const PROP_VERTEX_SHADER = assembleShader(propVertex);
export const PROP_FRAGMENT_SHADER = assembleShader(propFragment);
export const FULL_SCREEN_QUAD_VERTEX_SHADER = assembleShader(fullScreenQuadVertex);
export const FOG_FRAGMENT_SHADER = assembleShader(fogFragment);
export const GROUND_GRADE_FRAGMENT_SHADER = assembleShader(groundGradeFragment);
export const FALLING_LEAVES_VERTEX_SHADER = assembleShader(fallingLeavesVertex);
export const FALLING_LEAVES_FRAGMENT_SHADER = assembleShader(fallingLeavesFragment);
export const PRECIPITATION_FRAGMENT_SHADER = assembleShader(precipitationFragment);
export const CLOUDS_AND_LIGHTNING_FRAGMENT_SHADER = assembleShader(cloudsAndLightningFragment);
export const MAP_VIEW_FRAGMENT_SHADER = assembleShader(mapViewFragment);
export const RIVER_VERTEX_SHADER = assembleShader(riverVertex);
export const RIVER_FRAGMENT_SHADER = assembleShader(riverFragment);
export const LAKE_AND_SEA_FRAGMENT_SHADER = assembleShader(lakeAndSeaFragment);
export const FISH_VERTEX_SHADER = assembleShader(fishVertex);
export const FISH_FRAGMENT_SHADER = assembleShader(fishFragment);
export const INSECT_VERTEX_SHADER = assembleShader(insectsVertex);
export const INSECT_FRAGMENT_SHADER = assembleShader(insectsFragment);
