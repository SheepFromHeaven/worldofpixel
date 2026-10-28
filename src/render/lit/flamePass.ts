import type { UniformLocations } from './glHelpers.ts';
import { findUniforms, linkProgram, setViewUniforms, useAlphaBlendingForLayer } from './glHelpers.ts';
import { CAMPFIRE_FLAME_HEAD_TILES, CAMPFIRE_FLAME_SCALE, CAMPFIRE_FULL_STRENGTH, FLAME_FULL_STRENGTH, FLAME_RAMP, TORCH_FLAME_HEAD_TILES } from './flames.ts';
import type { PointLight } from './lighting.ts';
import { MAX_POINTS } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import { TORCH_FLAME_LIFT_TILES } from './litLayerConstants.ts';
import { FLAME_FRAGMENT_SHADER, FLAME_VERTEX_SHADER } from './shaders/shaderSources.ts';

const FLAME_UNIFORM_NAMES = ['uView', 'uBuffer', 'uTime', 'uFlame', 'uInfo', 'uRamp'] as const;

export class FlamePass {
  private readonly program: WebGLProgram;
  private readonly locations: UniformLocations<(typeof FLAME_UNIFORM_NAMES)[number]>;
  private readonly flames = new Float32Array(MAX_POINTS * 4);
  private readonly info = new Float32Array(MAX_POINTS * 4);

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly cornersVertexArray: WebGLVertexArrayObject,
  ) {
    this.program = linkProgram(gl, FLAME_VERTEX_SHADER, FLAME_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, FLAME_UNIFORM_NAMES);
  }

  draw(view: LitView, lights: readonly PointLight[], windAt: (x: number, y: number) => readonly [number, number]): void {
    const torches = lights.filter((light) => light.source !== 'hand').slice(0, MAX_POINTS);
    if (torches.length === 0) return;
    torches.forEach((light, index) => {
      const fire = light.source === 'fire';
      const footY = fire ? light.y : light.y + TORCH_FLAME_LIFT_TILES;
      const [east, south] = windAt(light.x, footY);
      this.flames.set([light.x, footY, east, south], index * 4);
      this.info.set([light.id % 997, light.strength / (fire ? CAMPFIRE_FULL_STRENGTH : FLAME_FULL_STRENGTH), fire ? CAMPFIRE_FLAME_SCALE : 1, fire ? CAMPFIRE_FLAME_HEAD_TILES : TORCH_FLAME_HEAD_TILES], index * 4);
    });

    const { gl, locations } = this;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.cornersVertexArray);
    useAlphaBlendingForLayer(gl, true);
    setViewUniforms(gl, locations, view);
    gl.uniform1f(locations.uTime, view.time);
    gl.uniform4fv(locations.uFlame, this.flames);
    gl.uniform4fv(locations.uInfo, this.info);
    gl.uniform3fv(locations.uRamp, FLAME_RAMP);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, torches.length);
    gl.depthMask(true);
  }
}
