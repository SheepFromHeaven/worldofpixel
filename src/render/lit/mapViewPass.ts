import { SEA_FLOOR_METRES, sliceElevation } from '../../sim/geology/geology.ts';
import { PEAK_METRES } from '../../sim/terrain/climate.ts';
import { SEA_LEVEL } from '../../sim/terrain/heightmap.ts';
import { CAVE_COLORS, MINERAL_COLORS, ROCK_COLORS } from '../palette.ts';
import type { SkyView } from '../../sim/weather/skyView.ts';
import { MAX_PRESSURE_CENTRES } from '../../sim/weather/pressureCentres.ts';
import type { World } from '../../sim/world.ts';
import type { UniformLocations } from './glHelpers.ts';
import { findUniforms, linkProgram, setViewUniforms, useAlphaBlendingWithoutDepth } from './glHelpers.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import { STRATA_VIEW_MODE } from './litLayerConstants.ts';
import { FULL_SCREEN_QUAD_VERTEX_SHADER } from './shaders/shaderSources.ts';
import { MAP_VIEW_FRAGMENT_SHADER } from './shaders/shaderSources.ts';
import { StrataTexture } from './strataTexture.ts';
import { TEXTURE_UNIT_ECO, TEXTURE_UNIT_HEIGHT, TEXTURE_UNIT_STRATA, TEXTURE_UNIT_STRATA_FIELD, TEXTURE_UNIT_STRATA_GROUND } from './textureUnits.ts';
import type { WeatherDataTextures, WeatherUniformLocations } from './weatherDataTextures.ts';
import { WEATHER_UNIFORM_NAMES } from './weatherDataTextures.ts';

const vectorsOf = (colours: readonly string[]): Float32Array => {
  const out = new Float32Array(colours.length * 3);
  colours.forEach((hex, index) => {
    out[index * 3] = parseInt(hex.slice(1, 3), 16) / 255;
    out[index * 3 + 1] = parseInt(hex.slice(3, 5), 16) / 255;
    out[index * 3 + 2] = parseInt(hex.slice(5, 7), 16) / 255;
  });
  return out;
};

const ROCK_VECTORS = vectorsOf(ROCK_COLORS);
const MINERAL_VECTORS = vectorsOf(MINERAL_COLORS);
const CAVE_VECTORS = vectorsOf([CAVE_COLORS.void, CAVE_COLORS.rim, CAVE_COLORS.water, CAVE_COLORS.waterRim, CAVE_COLORS.drip]);

const MAX_LAMPS = 16;
const LAMP_VERTICAL_REACH_METRES = 10;

const MAP_UNIFORM_NAMES = [
  'uView',
  'uBuffer',
  'uMode',
  'uTime',
  'uSea',
  'uHeight',
  'uEco',
  'uStrata',
  'uStrataField',
  'uGround',
  'uPlane',
  'uLamps',
  'uLampCount',
  'uMetres',
  'uRocks',
  'uMinerals',
  'uCaves',
  'uCentre',
  'uCentreCount',
  'uClock',
  'uYear',
  ...WEATHER_UNIFORM_NAMES,
] as const;

export class MapViewPass {
  private readonly program: WebGLProgram;
  private readonly strata: StrataTexture;
  private readonly locations: UniformLocations<(typeof MAP_UNIFORM_NAMES)[number]>;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly fullScreenVertexArray: WebGLVertexArrayObject,
    private readonly weather: WeatherDataTextures,
  ) {
    this.program = linkProgram(gl, FULL_SCREEN_QUAD_VERTEX_SHADER, MAP_VIEW_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, MAP_UNIFORM_NAMES);
    this.strata = new StrataTexture(gl);
  }

  draw(world: World, view: LitView, lighting: Lighting, viewMode: number, sky: SkyView): void {
    const { gl, locations } = this;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.fullScreenVertexArray);
    useAlphaBlendingWithoutDepth(gl);
    setViewUniforms(gl, locations, view);
    gl.uniform1f(locations.uMode, viewMode);
    gl.uniform1f(locations.uClock, lighting.moment.timeOfDay);
    gl.uniform1f(locations.uYear, lighting.moment.seasonPhase);
    gl.uniform1f(locations.uTime, view.time);
    gl.uniform1f(locations.uSea, SEA_LEVEL);
    this.weather.bindTo(locations as WeatherUniformLocations, world, view, lighting);
    gl.uniform1i(locations.uHeight, TEXTURE_UNIT_HEIGHT);
    gl.uniform1i(locations.uEco, TEXTURE_UNIT_ECO);

    if (viewMode === STRATA_VIEW_MODE) {
      this.strata.step(world, view, view.depth);
      gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_STRATA);
      gl.bindTexture(gl.TEXTURE_2D, this.strata.texture);
      gl.uniform1i(locations.uStrata, TEXTURE_UNIT_STRATA);
      gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_STRATA_FIELD);
      gl.bindTexture(gl.TEXTURE_2D, this.strata.field);
      gl.uniform1i(locations.uStrataField, TEXTURE_UNIT_STRATA_FIELD);
      gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_STRATA_GROUND);
      gl.bindTexture(gl.TEXTURE_2D, this.strata.ground);
      gl.uniform1i(locations.uGround, TEXTURE_UNIT_STRATA_GROUND);
      const plane = sliceElevation(world, view.depth);
      gl.uniform1f(locations.uPlane, plane);
      const lamps = new Float32Array(MAX_LAMPS * 4);
      let lit = 0;
      for (const [tile, elevation] of world.torchDepth) {
        const reach = 1 - Math.abs(elevation - plane) / LAMP_VERTICAL_REACH_METRES;
        if (reach <= 0 || lit >= MAX_LAMPS) continue;
        const at = world.grid.centre(tile);
        lamps.set([at.x, at.y, reach, 0], lit * 4);
        lit += 1;
      }
      gl.uniform4fv(locations.uLamps, lamps);
      gl.uniform1i(locations.uLampCount, lit);
      gl.uniform2f(locations.uMetres, PEAK_METRES, SEA_FLOOR_METRES);
      gl.uniform3fv(locations.uRocks, ROCK_VECTORS);
      gl.uniform3fv(locations.uMinerals, MINERAL_VECTORS);
      gl.uniform3fv(locations.uCaves, CAVE_VECTORS);
    }

    const centres = new Float32Array(MAX_PRESSURE_CENTRES * 4);
    sky.pressureCentres.forEach((centre, index) => {
      centres.set([centre.x, centre.y, centre.strength, 0], index * 4);
    });
    gl.uniform4fv(locations.uCentre, centres);
    gl.uniform1i(locations.uCentreCount, sky.pressureCentres.length);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
