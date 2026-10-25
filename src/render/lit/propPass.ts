import type { World } from '../../sim/world.ts';
import { TEXEL } from '../terrainPixels.ts';
import type { UniformLocations } from './glHelpers.ts';
import { findUniforms, linkProgram, zoomFade } from './glHelpers.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import {
  CANOPY_HIDE_FROM_ZOOM,
  CANOPY_HIDE_TO_ZOOM,
  FLOATS_PER_INSTANCE,
  POINT_LIGHT_HEIGHT,
} from './litLayerConstants.ts';
import type { PointLightData } from './pointLightData.ts';
import type { SpriteAtlas } from './propPlacementCache.ts';
import { PROP_FRAGMENT_SHADER, PROP_VERTEX_SHADER } from './shaders/shaderSources.ts';
import { TEXTURE_UNIT_SPRITE_ALBEDO, TEXTURE_UNIT_SPRITE_NORMALS } from './textureUnits.ts';
import type { WeatherUniformLocations } from './weatherDataTextures.ts';
import { WEATHER_UNIFORM_NAMES } from './weatherDataTextures.ts';
import type { WeatherDataTextures } from './weatherDataTextures.ts';

const PROP_UNIFORM_NAMES = [
  'uView',
  'uBuffer',
  'uAtlas',
  'uCast',
  'uAlbedo',
  'uNormal',
  'uShadowPass',
  'uCount',
  'uPoint',
  'uPointColor',
  'uLightHeight',
  'uTime',
  'uHide',
  'uWind',
  'uSeasonal',
  ...WEATHER_UNIFORM_NAMES,
] as const;

const SHADOW_PASS_ONTO_GROUND = 1;
const SHADOW_PASS_ONTO_MARKS = 2;
const NO_SHADOW_CAST = 0;
const SUN_SHADOW = 1;
const MOON_SHADOW = 2;
const STRONGEST_SHADOW = 3;
const FIRST_POINT_SHADOW = 4;
const POINT_STRENGTH_WORTH_DRAWING = 0.02;
const SHADOW_STRENGTH_WORTH_DRAWING = 0.01;

export class PropPass {
  private readonly program: WebGLProgram;
  private readonly locations: UniformLocations<(typeof PROP_UNIFORM_NAMES)[number]>;
  private readonly vertexArray: WebGLVertexArrayObject;
  private readonly instanceBuffer: WebGLBuffer;
  private instanceCount = 0;
  private pointLights: PointLightData | null = null;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    cornersBuffer: WebGLBuffer,
    private readonly weather: WeatherDataTextures,
  ) {
    this.program = linkProgram(gl, PROP_VERTEX_SHADER, PROP_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, PROP_UNIFORM_NAMES);
    this.instanceBuffer = gl.createBuffer()!;
    this.vertexArray = gl.createVertexArray()!;

    gl.bindVertexArray(this.vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, cornersBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    const strideBytes = FLOATS_PER_INSTANCE * 4;
    const attributeLayout: readonly (readonly [number, number, number])[] = [
      [1, 4, 0],
      [2, 4, 16],
      [3, 2, 32],
      [4, 2, 40],
    ];
    for (const [location, componentCount, byteOffset] of attributeLayout) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, componentCount, gl.FLOAT, false, strideBytes, byteOffset);
      gl.vertexAttribDivisor(location, 1);
    }
    gl.bindVertexArray(null);
  }

  prepareAndDrawGroundShadows(
    world: World,
    view: LitView,
    lighting: Lighting,
    atlas: SpriteAtlas,
    instances: Float32Array,
    instanceCount: number,
    pointLights: PointLightData,
  ): void {
    this.pointLights = pointLights;
    const { gl, locations } = this;
    this.instanceCount = instanceCount;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instances, gl.DYNAMIC_DRAW);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_SPRITE_ALBEDO);
    gl.bindTexture(gl.TEXTURE_2D, atlas.albedo);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_SPRITE_NORMALS);
    gl.bindTexture(gl.TEXTURE_2D, atlas.normal);
    gl.uniform1i(locations.uAlbedo, TEXTURE_UNIT_SPRITE_ALBEDO);
    gl.uniform1i(locations.uNormal, TEXTURE_UNIT_SPRITE_NORMALS);
    this.weather.bindTo(locations as WeatherUniformLocations, world, view, lighting);
    gl.uniform4f(locations.uView, view.centre.x, view.centre.y, view.zoom, TEXEL);
    gl.uniform2f(locations.uBuffer, view.width, view.height);
    gl.uniform2f(locations.uAtlas, atlas.width, atlas.height);
    gl.uniform1f(locations.uLightHeight, POINT_LIGHT_HEIGHT);
    gl.uniform1f(locations.uTime, view.time);
    gl.uniform1f(locations.uWind, lighting.wind);
    gl.uniform4fv(locations.uSeasonal, lighting.seasonalShaderTable);
    gl.uniform1i(locations.uCount, pointLights.count);
    gl.uniform4fv(locations.uPoint, pointLights.positionsAndReach);
    gl.uniform3fv(locations.uPointColor, pointLights.colours);
    gl.uniform1f(locations.uHide, zoomFade(view.zoom, CANOPY_HIDE_FROM_ZOOM, CANOPY_HIDE_TO_ZOOM));

    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform1f(locations.uShadowPass, SHADOW_PASS_ONTO_GROUND);
    const { sun, moon } = this.weather.shadowStrength;
    for (const [body, strength] of [
      [SUN_SHADOW, sun],
      [MOON_SHADOW, moon],
    ] as const) {
      if (strength < SHADOW_STRENGTH_WORTH_DRAWING) continue;
      gl.uniform1f(locations.uCast, body);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.instanceCount);
    }
    this.drawPointShadows();
  }

  private drawPointShadows(): void {
    const { gl, locations, pointLights } = this;
    if (pointLights === null) return;
    for (let index = 0; index < pointLights.count; index += 1) {
      if ((pointLights.positionsAndReach[index * 4 + 3] ?? 0) < POINT_STRENGTH_WORTH_DRAWING) continue;
      gl.uniform1f(locations.uCast, FIRST_POINT_SHADOW + index);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.instanceCount);
    }
  }

  drawPropsAndShadowsOntoMarks(): void {
    const { gl, locations } = this;
    if (this.instanceCount === 0) return;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.STENCIL_TEST);
    gl.stencilFunc(gl.ALWAYS, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    gl.uniform1f(locations.uShadowPass, 0);
    gl.uniform1f(locations.uCast, NO_SHADOW_CAST);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.instanceCount);

    const { sun, moon } = this.weather.shadowStrength;
    const lit = (this.pointLights?.count ?? 0) > 0;
    if (Math.max(sun, moon) < SHADOW_STRENGTH_WORTH_DRAWING && !lit) {
      gl.disable(gl.STENCIL_TEST);
      return;
    }

    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
    gl.depthFunc(gl.LESS);
    gl.depthMask(false);
    gl.stencilFunc(gl.EQUAL, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
    gl.uniform1f(locations.uCast, STRONGEST_SHADOW);
    gl.uniform1f(locations.uShadowPass, SHADOW_PASS_ONTO_MARKS);
    if (Math.max(sun, moon) >= SHADOW_STRENGTH_WORTH_DRAWING) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.instanceCount);
    gl.stencilFunc(gl.LEQUAL, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    this.drawPointShadows();
    gl.depthMask(true);
    gl.disable(gl.STENCIL_TEST);
  }
}
