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
import { TORCH_SHADOW_KEY_STRIDE } from './propPlacementCache.ts';
import { PROP_FRAGMENT_SHADER, PROP_VERTEX_SHADER } from './shaders/shaderSources.ts';
import { TEXTURE_UNIT_SPRITE_ALBEDO, TEXTURE_UNIT_SPRITE_CROP, TEXTURE_UNIT_SPRITE_NORMALS, TEXTURE_UNIT_TORCH_OCCLUDER } from './textureUnits.ts';
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
  'uCrop',
  'uShadowPass',
  'uCount',
  'uPoint',
  'uPointColor',
  'uLightHeight',
  'uTime',
  'uHide',
  'uWind',
  'uSeasonal',
  'uOccluderRange',
  ...WEATHER_UNIFORM_NAMES,
] as const;

const SHADOW_PASS_OCCLUDER = 4;
const SHADOW_PASS_ONTO_GROUND = 1;
const SHADOW_PASS_ONTO_MARKS = 2;
const DEPTH_PREPASS = 3;
const PREPASS_DEPTH_BIAS = 2;
const NO_SHADOW_CAST = 0;
const SUN_SHADOW = 1;
const MOON_SHADOW = 2;
const STRONGEST_SHADOW = 3;
const FIRST_POINT_SHADOW = 4;
const POINT_STRENGTH_WORTH_DRAWING = 0.02;
const SHADOW_STRENGTH_WORTH_DRAWING = 0.01;
const TORCH_SMALL_SHADOWS_FROM_ZOOM = 30;
const TORCH_SHADOW_CASTERS = 16;
const OCCLUDER_MARGIN_TILES = 6;
const OCCLUDER_PIXELS_PER_TILE = 8;
const OCCLUDER_MAX_SIZE = 1536;
const OCCLUDER_RANGE_TILES = 4;
const MARCH_LIGHT_HEIGHT = 0.9;
const MARCH_STRENGTH = 0.85;
const CANOPY_FLAG = 1;
const HIDES_FLAG = 8;

const isLarge = (flags: number): boolean => (flags & (CANOPY_FLAG | HIDES_FLAG)) !== 0;

const tuned = (name: string, fallback: number): number => {
  const value = (globalThis as Record<string, unknown>)[name];
  return typeof value === 'number' ? value : fallback;
};

const ATTRIBUTE_LAYOUT: readonly (readonly [number, number, number])[] = [
  [1, 4, 0],
  [2, 4, 16],
  [3, 2, 32],
  [4, 2, 40],
];

export interface TorchOccluders {
  readonly texture: WebGLTexture;
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
  readonly lightHeight: number;
  readonly strength: number;
  readonly range: number;
}

type TorchShadowMode = 'march' | 'sprites' | 'off';

const torchShadowMode = (): TorchShadowMode => {
  const value = (globalThis as Record<string, unknown>).litTorchShadows;
  return value === 'sprites' || value === 'off' ? value : 'march';
};

interface LightCasters {
  readonly vertexArray: WebGLVertexArrayObject;
  readonly buffer: WebGLBuffer;
  count: number;
}

export class PropPass {
  private readonly program: WebGLProgram;
  private readonly locations: UniformLocations<(typeof PROP_UNIFORM_NAMES)[number]>;
  private readonly vertexArray: WebGLVertexArrayObject;
  private readonly instanceBuffer: WebGLBuffer;
  private instanceCount = 0;
  private casterCount = 0;
  private pointLights: PointLightData | null = null;
  private readonly lightCasters: LightCasters[] = [];
  private scratch = new Float32Array(0);
  private occluderCasters: LightCasters | null = null;
  private occluderFramebuffer: WebGLFramebuffer | null = null;
  private occluderTexture: WebGLTexture | null = null;
  private occluderSize = { width: 0, height: 0 };
  occluders: TorchOccluders | null = null;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly cornersBuffer: WebGLBuffer,
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
    this.bindInstanceAttributes(this.instanceBuffer);
    gl.bindVertexArray(null);
  }

  private bindInstanceAttributes(buffer: WebGLBuffer): void {
    const { gl } = this;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const strideBytes = FLOATS_PER_INSTANCE * 4;
    for (const [location, componentCount, byteOffset] of ATTRIBUTE_LAYOUT) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, componentCount, gl.FLOAT, false, strideBytes, byteOffset);
      gl.vertexAttribDivisor(location, 1);
    }
  }

  private createCasters(): LightCasters {
    const { gl } = this;
    const vertexArray = gl.createVertexArray()!;
    const buffer = gl.createBuffer()!;
    gl.bindVertexArray(vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornersBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.bindInstanceAttributes(buffer);
    gl.bindVertexArray(null);
    return { vertexArray, buffer, count: 0 };
  }

  private casterSlot(index: number): LightCasters {
    return (this.lightCasters[index] ??= this.createCasters());
  }

  private drawOccluders(view: LitView, atlas: SpriteAtlas, instances: Float32Array, casterCount: number): void {
    const { gl, locations } = this;
    const smallToo = view.zoom > TORCH_SMALL_SHADOWS_FROM_ZOOM;
    const needed = casterCount * FLOATS_PER_INSTANCE;
    if (this.scratch.length < needed) this.scratch = new Float32Array(needed);
    let used = 0;
    for (let at = 0; at < needed; at += FLOATS_PER_INSTANCE) {
      if (!atlas.torchShadow.has(instances[at + 3]! * TORCH_SHADOW_KEY_STRIDE + instances[at + 2]!)) continue;
      if (!smallToo && !isLarge(instances[at + 11]!)) continue;
      this.scratch.set(instances.subarray(at, at + FLOATS_PER_INSTANCE), used);
      used += FLOATS_PER_INSTANCE;
    }

    const halfWidth = view.width / (2 * view.zoom) + OCCLUDER_MARGIN_TILES;
    const halfHeight = view.height / (2 * view.zoom) + OCCLUDER_MARGIN_TILES;
    const resolution = Math.min(OCCLUDER_PIXELS_PER_TILE, OCCLUDER_MAX_SIZE / (2 * Math.max(halfWidth, halfHeight)));
    const width = Math.max(1, Math.ceil(2 * halfWidth * resolution));
    const height = Math.max(1, Math.ceil(2 * halfHeight * resolution));

    if (!this.occluderTexture || this.occluderSize.width !== width || this.occluderSize.height !== height) {
      this.occluderTexture ??= gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_TORCH_OCCLUDER);
      gl.bindTexture(gl.TEXTURE_2D, this.occluderTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.occluderFramebuffer ??= gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.occluderFramebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.occluderTexture, 0);
      this.occluderSize = { width, height };
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.occluderFramebuffer);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (used > 0) {
      const casters = (this.occluderCasters ??= this.createCasters());
      casters.count = used / FLOATS_PER_INSTANCE;
      gl.bindBuffer(gl.ARRAY_BUFFER, casters.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.scratch.subarray(0, used), gl.DYNAMIC_DRAW);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.STENCIL_TEST);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.MAX);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform4f(locations.uView, view.centre.x, view.centre.y, resolution, TEXEL);
      gl.uniform2f(locations.uBuffer, width, height);
      gl.uniform1f(locations.uShadowPass, SHADOW_PASS_OCCLUDER);
      gl.uniform1f(locations.uCast, NO_SHADOW_CAST);
      gl.uniform1f(locations.uOccluderRange, OCCLUDER_RANGE_TILES);
      gl.bindVertexArray(casters.vertexArray);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, casters.count);
      gl.bindVertexArray(this.vertexArray);
      gl.uniform4f(locations.uView, view.centre.x, view.centre.y, view.zoom, TEXEL);
      gl.uniform2f(locations.uBuffer, view.width, view.height);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, view.width, view.height);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_SPRITE_CROP);

    this.occluders = {
      texture: this.occluderTexture!,
      minX: view.centre.x - width / resolution / 2,
      minY: view.centre.y - height / resolution / 2,
      width: width / resolution,
      height: height / resolution,
      lightHeight: tuned('litMarchHeight', MARCH_LIGHT_HEIGHT),
      strength: tuned('litMarchStrength', MARCH_STRENGTH),
      range: OCCLUDER_RANGE_TILES,
    };
  }

  private gatherLightCasters(instances: Float32Array, casterCount: number, pointLights: PointLightData, atlas: SpriteAtlas, zoom: number): void {
    const { gl } = this;
    const needed = casterCount * FLOATS_PER_INSTANCE;
    const smallToo = zoom > TORCH_SMALL_SHADOWS_FROM_ZOOM;
    if (this.scratch.length < needed) this.scratch = new Float32Array(needed);
    for (let index = 0; index < pointLights.count; index += 1) {
      const slot = this.casterSlot(index);
      slot.count = 0;
      if ((pointLights.positionsAndReach[index * 4 + 3] ?? 0) < POINT_STRENGTH_WORTH_DRAWING) continue;
      const lightX = pointLights.positionsAndReach[index * 4]!;
      const lightY = pointLights.positionsAndReach[index * 4 + 1]!;
      const reach = pointLights.positionsAndReach[index * 4 + 2]!;
      const cap = tuned('litTorchCasters', TORCH_SHADOW_CASTERS);
      const nearest: { at: number; distance: number }[] = [];
      for (let at = 0; at < needed; at += FLOATS_PER_INSTANCE) {
        if (!atlas.torchShadow.has(instances[at + 3]! * TORCH_SHADOW_KEY_STRIDE + instances[at + 2]!)) continue;
        if (!smallToo && !isLarge(instances[at + 11]!)) continue;
        const within = reach + instances[at + 4]! * TEXEL;
        const dx = instances[at]! - lightX;
        const dy = instances[at + 1]! - lightY;
        if (Math.abs(dx) > within || Math.abs(dy) > within) continue;
        nearest.push({ at, distance: dx * dx + dy * dy });
      }
      if (nearest.length > cap) {
        nearest.sort((a, b) => a.distance - b.distance);
        nearest.length = cap;
      }
      let used = 0;
      for (const { at } of nearest) {
        this.scratch.set(instances.subarray(at, at + FLOATS_PER_INSTANCE), used);
        used += FLOATS_PER_INSTANCE;
      }
      slot.count = used / FLOATS_PER_INSTANCE;
      if (slot.count === 0) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, slot.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.scratch.subarray(0, used), gl.DYNAMIC_DRAW);
    }
  }

  prepareAndDrawGroundShadows(
    world: World,
    view: LitView,
    lighting: Lighting,
    atlas: SpriteAtlas,
    instances: Float32Array,
    instanceCount: number,
    casterCount: number,
    pointLights: PointLightData,
  ): void {
    this.pointLights = pointLights;
    const { gl, locations } = this;
    this.instanceCount = instanceCount;
    this.casterCount = casterCount;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instances, gl.DYNAMIC_DRAW);
    const mode = torchShadowMode();
    if (mode === 'sprites') this.gatherLightCasters(instances, casterCount, pointLights, atlas, view.zoom);
    gl.bindVertexArray(this.vertexArray);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_SPRITE_ALBEDO);
    gl.bindTexture(gl.TEXTURE_2D, atlas.albedo);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_SPRITE_NORMALS);
    gl.bindTexture(gl.TEXTURE_2D, atlas.normal);
    gl.uniform1i(locations.uAlbedo, TEXTURE_UNIT_SPRITE_ALBEDO);
    gl.uniform1i(locations.uNormal, TEXTURE_UNIT_SPRITE_NORMALS);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_SPRITE_CROP);
    gl.bindTexture(gl.TEXTURE_2D, atlas.crop);
    gl.uniform1i(locations.uCrop, TEXTURE_UNIT_SPRITE_CROP);
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

    this.occluders = null;
    if (mode === 'march') this.drawOccluders(view, atlas, instances, casterCount);

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
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.casterCount);
    }
    if (mode === 'sprites') this.drawPointShadows();
  }

  private drawPointShadows(): void {
    const { gl, locations, pointLights } = this;
    if (pointLights === null) return;
    for (let index = 0; index < pointLights.count; index += 1) {
      if ((pointLights.positionsAndReach[index * 4 + 3] ?? 0) < POINT_STRENGTH_WORTH_DRAWING) continue;
      const slot = this.lightCasters[index];
      if (!slot || slot.count === 0) continue;
      gl.uniform1f(locations.uCast, FIRST_POINT_SHADOW + index);
      gl.bindVertexArray(slot.vertexArray);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, slot.count);
    }
    gl.bindVertexArray(this.vertexArray);
  }

  drawPropsAndShadowsOntoMarks(): void {
    const { gl, locations } = this;
    if (this.instanceCount === 0) return;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.STENCIL_TEST);
    gl.colorMask(false, false, false, false);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(PREPASS_DEPTH_BIAS, PREPASS_DEPTH_BIAS);
    gl.uniform1f(locations.uShadowPass, DEPTH_PREPASS);
    gl.uniform1f(locations.uCast, NO_SHADOW_CAST);
    if ((globalThis as { litPrepass?: boolean }).litPrepass !== false) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.instanceCount);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.colorMask(true, true, true, true);
    gl.enable(gl.STENCIL_TEST);
    gl.stencilFunc(gl.ALWAYS, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    gl.uniform1f(locations.uShadowPass, 0);
    gl.uniform1f(locations.uCast, NO_SHADOW_CAST);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.instanceCount);

    const { sun, moon } = this.weather.shadowStrength;
    if (Math.max(sun, moon) < SHADOW_STRENGTH_WORTH_DRAWING) {
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
    if (Math.max(sun, moon) >= SHADOW_STRENGTH_WORTH_DRAWING) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.casterCount);
    gl.stencilFunc(gl.LEQUAL, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    gl.depthMask(true);
    gl.disable(gl.STENCIL_TEST);
  }
}
