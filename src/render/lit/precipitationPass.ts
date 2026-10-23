import type { World } from '../../sim/world.ts';
import type { UniformLocations } from './glHelpers.ts';
import { findUniforms, linkProgram, setViewUniforms, useAlphaBlendingWithoutDepth, zoomFade } from './glHelpers.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import { CANOPY_HIDE_FROM_ZOOM, CANOPY_HIDE_TO_ZOOM } from './litLayerConstants.ts';
import { FULL_SCREEN_QUAD_VERTEX_SHADER } from './shaders/shaderSources.ts';
import { PRECIPITATION_FRAGMENT_SHADER } from './shaders/shaderSources.ts';
import type { WeatherDataTextures, WeatherUniformLocations } from './weatherDataTextures.ts';
import { WEATHER_UNIFORM_NAMES } from './weatherDataTextures.ts';

const PRECIPITATION_UNIFORM_NAMES = ['uView', 'uBuffer', 'uVisible', 'uTime', 'uSlant', 'uSand', ...WEATHER_UNIFORM_NAMES] as const;

const PRECIPITATION_FADES_IN_FROM_ZOOM = 3;
const PRECIPITATION_FULLY_VISIBLE_AT_ZOOM = 9;
const RAIN_SLANT = 0.22;

export class PrecipitationPass {
  private readonly program: WebGLProgram;
  private readonly locations: UniformLocations<(typeof PRECIPITATION_UNIFORM_NAMES)[number]>;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly fullScreenVertexArray: WebGLVertexArrayObject,
    private readonly weather: WeatherDataTextures,
  ) {
    this.program = linkProgram(gl, FULL_SCREEN_QUAD_VERTEX_SHADER, PRECIPITATION_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, PRECIPITATION_UNIFORM_NAMES);
  }

  draw(world: World, view: LitView, lighting: Lighting): void {
    const { gl, locations } = this;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.fullScreenVertexArray);
    useAlphaBlendingWithoutDepth(gl);
    setViewUniforms(gl, locations, view);

    const beneathCanopy = zoomFade(view.zoom, CANOPY_HIDE_FROM_ZOOM, CANOPY_HIDE_TO_ZOOM);
    const zoomVisibility = zoomFade(view.zoom, PRECIPITATION_FADES_IN_FROM_ZOOM, PRECIPITATION_FULLY_VISIBLE_AT_ZOOM);
    gl.uniform1f(locations.uVisible, zoomVisibility * (1 - beneathCanopy));
    gl.uniform1f(locations.uTime, view.time);
    const windDirection = Math.sign(lighting.drift[0] || 1);
    gl.uniform1f(locations.uSlant, RAIN_SLANT * windDirection);
    gl.uniform1f(locations.uSand, windDirection);
    this.weather.bindTo(locations as WeatherUniformLocations, world, view, lighting);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
