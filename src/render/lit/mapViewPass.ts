import { SEA_LEVEL } from '../../sim/terrain/heightmap.ts';
import type { SkyView } from '../../sim/weather/skyView.ts';
import { MAX_PRESSURE_CENTRES } from '../../sim/weather/pressureCentres.ts';
import type { World } from '../../sim/world.ts';
import type { UniformLocations } from './glHelpers.ts';
import { findUniforms, linkProgram, setViewUniforms, useAlphaBlendingWithoutDepth } from './glHelpers.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import { FULL_SCREEN_QUAD_VERTEX_SHADER } from './shaders/shaderSources.ts';
import { MAP_VIEW_FRAGMENT_SHADER } from './shaders/shaderSources.ts';
import { TEXTURE_UNIT_ECO, TEXTURE_UNIT_HEIGHT } from './textureUnits.ts';
import type { WeatherDataTextures, WeatherUniformLocations } from './weatherDataTextures.ts';
import { WEATHER_UNIFORM_NAMES } from './weatherDataTextures.ts';

const MAP_UNIFORM_NAMES = [
  'uView',
  'uBuffer',
  'uMode',
  'uTime',
  'uSea',
  'uHeight',
  'uEco',
  'uCentre',
  'uCentreCount',
  'uClock',
  'uYear',
  ...WEATHER_UNIFORM_NAMES,
] as const;

export class MapViewPass {
  private readonly program: WebGLProgram;
  private readonly locations: UniformLocations<(typeof MAP_UNIFORM_NAMES)[number]>;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly fullScreenVertexArray: WebGLVertexArrayObject,
    private readonly weather: WeatherDataTextures,
  ) {
    this.program = linkProgram(gl, FULL_SCREEN_QUAD_VERTEX_SHADER, MAP_VIEW_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, MAP_UNIFORM_NAMES);
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

    const centres = new Float32Array(MAX_PRESSURE_CENTRES * 4);
    sky.pressureCentres.forEach((centre, index) => {
      centres.set([centre.x, centre.y, centre.strength, 0], index * 4);
    });
    gl.uniform4fv(locations.uCentre, centres);
    gl.uniform1i(locations.uCentreCount, sky.pressureCentres.length);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
