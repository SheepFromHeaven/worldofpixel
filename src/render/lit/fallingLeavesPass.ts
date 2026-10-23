import type { World } from '../../sim/world.ts';
import type { UniformLocations } from './glHelpers.ts';
import { findUniforms, linkProgram, setViewUniforms, useAlphaBlendingWithoutDepth, zoomFade } from './glHelpers.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import { FALLING_LEAVES_FRAGMENT_SHADER } from './shaders/shaderSources.ts';
import { FULL_SCREEN_QUAD_VERTEX_SHADER } from './shaders/shaderSources.ts';
import { TEXTURE_UNIT_LEAF_AND_PETAL_SOURCES } from './textureUnits.ts';
import type { WeatherDataTextures, WeatherUniformLocations } from './weatherDataTextures.ts';
import { WEATHER_UNIFORM_NAMES } from './weatherDataTextures.ts';

const FALLING_LEAVES_UNIFORM_NAMES = ['uView', 'uBuffer', 'uTime', 'uFall', 'uBlow', 'uVisible', 'uSources', ...WEATHER_UNIFORM_NAMES] as const;

const LEAVES_FADE_IN_FROM_ZOOM = 5;
const LEAVES_FULLY_VISIBLE_AT_ZOOM = 11;
const NOTHING_FALLING = 0.01;

export class FallingLeavesPass {
  private readonly program: WebGLProgram;
  private readonly locations: UniformLocations<(typeof FALLING_LEAVES_UNIFORM_NAMES)[number]>;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly fullScreenVertexArray: WebGLVertexArrayObject,
    private readonly weather: WeatherDataTextures,
  ) {
    this.program = linkProgram(gl, FULL_SCREEN_QUAD_VERTEX_SHADER, FALLING_LEAVES_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, FALLING_LEAVES_UNIFORM_NAMES);
  }

  draw(world: World, view: LitView, lighting: Lighting): void {
    if (Math.max(...lighting.fallingLeaves, ...lighting.blowingPetals) < NOTHING_FALLING) return;
    const visible = zoomFade(view.zoom, LEAVES_FADE_IN_FROM_ZOOM, LEAVES_FULLY_VISIBLE_AT_ZOOM);
    if (visible <= 0) return;

    const { gl, locations } = this;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.fullScreenVertexArray);
    useAlphaBlendingWithoutDepth(gl);
    setViewUniforms(gl, locations, view);
    gl.uniform1f(locations.uTime, view.time);
    gl.uniform2f(locations.uFall, ...lighting.fallingLeaves);
    gl.uniform2f(locations.uBlow, ...lighting.blowingPetals);
    gl.uniform1f(locations.uVisible, visible);
    this.weather.bindTo(locations as WeatherUniformLocations, world, view, lighting);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_LEAF_AND_PETAL_SOURCES);
    gl.bindTexture(gl.TEXTURE_2D, this.weather.leafAndPetalSourcesTexture);
    gl.uniform1i(locations.uSources, TEXTURE_UNIT_LEAF_AND_PETAL_SOURCES);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
