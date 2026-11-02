import type { World } from '../../sim/world.ts';
import { FISH_APPEAR_AT_ZOOM, FISH_FULL_AT_ZOOM, fishInstances } from './fishInstances.ts';
import type { UniformLocations } from '../../render/lit/glHelpers.ts';
import { findUniforms, linkProgram, setViewUniforms, useAlphaBlendingWithoutDepth, zoomFade } from '../../render/lit/glHelpers.ts';
import type { Lighting } from '../../render/lit/lighting.ts';
import type { LitView } from '../../render/lit/litLayer.ts';
import { assembleShader } from '../../render/lit/shaders/shaderSources.ts';
import fishFragment from './shaders/fish.frag?raw';
import fishVertex from './shaders/fish.vert?raw';
import { TEXTURE_UNIT_PAINTED_GROUND } from '../../render/lit/textureUnits.ts';
import type { WeatherDataTextures, WeatherUniformLocations } from '../../render/lit/weatherDataTextures.ts';
import { WEATHER_UNIFORM_NAMES } from '../../render/lit/weatherDataTextures.ts';
import { TEXELS_PER_TILE } from '../../sim/grid.ts';

const DEFINES: readonly (readonly [string, string])[] = [
  ['FISH_TEXELS', `${TEXELS_PER_TILE}`],
];

const FISH_VERTEX_SHADER = assembleShader(fishVertex, DEFINES);
const FISH_FRAGMENT_SHADER = assembleShader(fishFragment, DEFINES);


const FISH_UNIFORM_NAMES = ['uView', 'uBuffer', 'uTime', 'uVisible', 'uGround', ...WEATHER_UNIFORM_NAMES] as const;

const BYTES_PER_FLOAT = 4;
const STRIDE_BYTES = 12 * BYTES_PER_FLOAT;

export class FishPass {
  private readonly program: WebGLProgram;
  private readonly locations: UniformLocations<(typeof FISH_UNIFORM_NAMES)[number]>;
  private readonly vertexArray: WebGLVertexArrayObject;
  private readonly instanceBuffer: WebGLBuffer;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    cornersBuffer: WebGLBuffer,
    private readonly weather: WeatherDataTextures,
  ) {
    this.program = linkProgram(gl, FISH_VERTEX_SHADER, FISH_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, FISH_UNIFORM_NAMES);
    this.vertexArray = gl.createVertexArray()!;
    this.instanceBuffer = gl.createBuffer()!;
    gl.bindVertexArray(this.vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, cornersBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    for (const [location, offset] of [[1, 0], [2, 4 * BYTES_PER_FLOAT], [3, 8 * BYTES_PER_FLOAT]] as const) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 4, gl.FLOAT, false, STRIDE_BYTES, offset);
      gl.vertexAttribDivisor(location, 1);
    }
    gl.bindVertexArray(null);
  }

  draw(world: World, view: LitView, lighting: Lighting): void {
    if (!view.shoals || !view.ground) return;
    const visible = zoomFade(view.zoom, FISH_APPEAR_AT_ZOOM, FISH_FULL_AT_ZOOM);
    if (visible <= 0.01) return;
    const { data, count } = fishInstances(view.shoals, view, lighting.daylight);
    if (count === 0) return;

    const { gl, locations } = this;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    useAlphaBlendingWithoutDepth(gl);
    setViewUniforms(gl, locations, view);
    gl.uniform1f(locations.uTime, view.time);
    gl.uniform1f(locations.uVisible, visible);
    this.weather.bindTo(locations as WeatherUniformLocations, world, view, lighting);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_PAINTED_GROUND);
    gl.uniform1i(locations.uGround, TEXTURE_UNIT_PAINTED_GROUND);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.bindVertexArray(null);
  }
}
