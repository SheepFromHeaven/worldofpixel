import type { UniformLocations } from './glHelpers.ts';
import { findUniforms, linkProgram, setViewUniforms, useAlphaBlendingWithoutDepth } from './glHelpers.ts';
import type { LitView } from './litLayer.ts';
import { FOG_FRAGMENT_SHADER, FULL_SCREEN_QUAD_VERTEX_SHADER } from './shaders/shaderSources.ts';

const FOG_UNIFORM_NAMES = ['uView', 'uBuffer', 'uFog'] as const;

export class FogPass {
  private readonly program: WebGLProgram;
  private readonly locations: UniformLocations<(typeof FOG_UNIFORM_NAMES)[number]>;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly fullScreenVertexArray: WebGLVertexArrayObject,
  ) {
    this.program = linkProgram(gl, FULL_SCREEN_QUAD_VERTEX_SHADER, FOG_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, FOG_UNIFORM_NAMES);
  }

  draw(view: LitView): void {
    const { fog } = view;
    if (!fog) return;

    const { gl, locations } = this;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.fullScreenVertexArray);
    useAlphaBlendingWithoutDepth(gl);
    setViewUniforms(gl, locations, view);
    gl.uniform4f(locations.uFog, fog.x, fog.y, fog.inner, fog.edge);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
