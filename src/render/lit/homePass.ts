import type { World } from '../../sim/world.ts';
import { PACKED_HOME_FLOATS } from './homeInstances.ts';
import { homeInstances } from './homeInstances.ts';
import type { UniformLocations } from './glHelpers.ts';
import { findUniforms, linkProgram, nightGloom, setViewUniforms, useAlphaBlendingWithoutDepth } from './glHelpers.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import { HOME_FRAGMENT_SHADER, HOME_VERTEX_SHADER } from './shaders/shaderSources.ts';
import { TEXTURE_UNIT_PAINTED_GROUND } from './textureUnits.ts';

const HOME_UNIFORM_NAMES = ['uView', 'uBuffer', 'uGround', 'uGloom', 'uTint'] as const;

const BYTES_PER_FLOAT = 4;

export const HOMES_FROM_ZOOM = 6;

export class HomePass {
  private readonly program: WebGLProgram;
  private readonly locations: UniformLocations<(typeof HOME_UNIFORM_NAMES)[number]>;
  private readonly vertexArray: WebGLVertexArrayObject;
  private readonly instanceBuffer: WebGLBuffer;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    cornersBuffer: WebGLBuffer,
  ) {
    this.program = linkProgram(gl, HOME_VERTEX_SHADER, HOME_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, HOME_UNIFORM_NAMES);
    this.vertexArray = gl.createVertexArray()!;
    this.instanceBuffer = gl.createBuffer()!;
    gl.bindVertexArray(this.vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, cornersBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    for (const [location, offset] of [[1, 0], [2, 4 * BYTES_PER_FLOAT]] as const) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 4, gl.FLOAT, false, PACKED_HOME_FLOATS * BYTES_PER_FLOAT, offset);
      gl.vertexAttribDivisor(location, 1);
    }
    gl.bindVertexArray(null);
  }

  draw(world: World, view: LitView, lighting: Lighting): void {
    if (view.zoom < HOMES_FROM_ZOOM || !view.ground) return;
    const now = view.homeTime ?? lighting.moment.completedDays + lighting.moment.timeOfDay;
    const { data, count } = homeInstances(world.homes, view, now);
    if (count === 0) return;
    const { gl, locations } = this;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    useAlphaBlendingWithoutDepth(gl);
    setViewUniforms(gl, locations, view);
    gl.uniform1f(locations.uGloom, nightGloom(lighting));
    gl.uniform3f(locations.uTint, lighting.tint[0], lighting.tint[1], lighting.tint[2]);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_PAINTED_GROUND);
    gl.uniform1i(locations.uGround, TEXTURE_UNIT_PAINTED_GROUND);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.bindVertexArray(null);
  }
}
