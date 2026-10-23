import type { World } from '../../sim/world.ts';
import type { UniformLocations } from './glHelpers.ts';
import { findUniforms, linkProgram, setViewUniforms, useAlphaBlendingWithoutDepth } from './glHelpers.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import type { PointLightData } from './pointLightData.ts';
import { FULL_SCREEN_QUAD_VERTEX_SHADER, GROUND_GRADE_FRAGMENT_SHADER } from './shaders/shaderSources.ts';
import { TEXTURE_UNIT_LEAF_AND_PETAL_SOURCES } from './textureUnits.ts';
import type { WeatherUniformLocations } from './weatherDataTextures.ts';
import type { WeatherDataTextures } from './weatherDataTextures.ts';
import { WEATHER_UNIFORM_NAMES } from './weatherDataTextures.ts';

const GRADE_UNIFORM_NAMES = [
  'uView',
  'uBuffer',
  'uTint',
  'uLitter',
  'uSources',
  'uCount',
  'uPoint',
  'uPointColor',
  ...WEATHER_UNIFORM_NAMES,
] as const;

export class GroundGradePass {
  private readonly program: WebGLProgram;
  private readonly locations: UniformLocations<(typeof GRADE_UNIFORM_NAMES)[number]>;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly fullScreenVertexArray: WebGLVertexArrayObject,
    private readonly weather: WeatherDataTextures,
  ) {
    this.program = linkProgram(gl, FULL_SCREEN_QUAD_VERTEX_SHADER, GROUND_GRADE_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, GRADE_UNIFORM_NAMES);
  }

  draw(world: World, view: LitView, lighting: Lighting, pointLights: PointLightData): void {
    const { gl, locations } = this;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.fullScreenVertexArray);
    useAlphaBlendingWithoutDepth(gl);
    setViewUniforms(gl, locations, view);
    gl.uniform3f(locations.uTint, ...lighting.tint);
    gl.uniform2f(locations.uLitter, ...lighting.leafLitter);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_LEAF_AND_PETAL_SOURCES);
    gl.bindTexture(gl.TEXTURE_2D, this.weather.leafAndPetalSourcesTexture);
    gl.uniform1i(locations.uSources, TEXTURE_UNIT_LEAF_AND_PETAL_SOURCES);
    gl.uniform1i(locations.uCount, pointLights.count);
    gl.uniform4fv(locations.uPoint, pointLights.positionsAndReach);
    gl.uniform3fv(locations.uPointColor, pointLights.colours);
    this.weather.bindTo(locations as WeatherUniformLocations, world, view, lighting);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
