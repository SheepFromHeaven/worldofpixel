import { PEAK_METRES } from '../../sim/terrain/climate.ts';
import type { World } from '../../sim/world.ts';
import { TERRAIN_LIGHT } from '../palette.ts';
import type { UniformLocations } from './glHelpers.ts';
import { findUniforms, linkProgram, setTextureFiltering, setViewUniforms, useAlphaBlendingWithoutDepth } from './glHelpers.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import { FULL_SCREEN_QUAD_VERTEX_SHADER, TERRAIN_COARSE_FRAGMENT_SHADER, TERRAIN_LIGHT_FRAGMENT_SHADER } from './shaders/shaderSources.ts';
import { TEXTURE_UNIT_TERRAIN, TEXTURE_UNIT_TERRAIN_COARSE } from './textureUnits.ts';
import { TerrainTexture } from './terrainTexture.ts';
import type { WeatherUniformLocations } from './weatherDataTextures.ts';
import type { WeatherDataTextures } from './weatherDataTextures.ts';
import { WEATHER_UNIFORM_NAMES } from './weatherDataTextures.ts';

const COARSE_UNIFORM_NAMES = ['uView', 'uBuffer', 'uTerrain', 'uTerrainParams', 'uSwitch', 'uCoarse', ...WEATHER_UNIFORM_NAMES] as const;
const TERRAIN_UNIFORM_NAMES = [...COARSE_UNIFORM_NAMES, 'uCoarseLight', 'uTone'] as const;

const COARSE_PIXELS = 6;

const SLOPE_SCALE = 1 / 24;
const SLOPE_REACH_TILES = 4;

const TONES = [
  TERRAIN_LIGHT.shade,
  TERRAIN_LIGHT.sunlit,
  TERRAIN_LIGHT.moonlit,
  TERRAIN_LIGHT.altitude,
  TERRAIN_LIGHT.faceDark,
  TERRAIN_LIGHT.faceLight,
  TERRAIN_LIGHT.lip,
  TERRAIN_LIGHT.contact,
  TERRAIN_LIGHT.hollow,
];

const TONE_VALUES = new Float32Array(
  TONES.flatMap((tone) => [(tone >>> 24) / 255, ((tone >>> 16) & 0xff) / 255, ((tone >>> 8) & 0xff) / 255]),
);

const setting = (name: string, fallback: number): number => {
  const value = (globalThis as Record<string, unknown>)[name];
  if (value === false) return 0;
  return typeof value === 'number' ? value : fallback;
};

export const terrainLightSwitches = (): readonly [number, number, number, number] => {
  const all = setting('litTerrain', 1);
  return [
    all * setting('litTerrainLight', 1),
    all * setting('litTerrainShadows', 1),
    all * setting('litTerrainFaces', 1),
    all * setting('litTerrainCues', 1),
  ];
};

export class TerrainLightPass {
  private readonly program: WebGLProgram;
  private readonly coarseProgram: WebGLProgram;
  private readonly locations: UniformLocations<(typeof TERRAIN_UNIFORM_NAMES)[number]>;
  private readonly coarseLocations: UniformLocations<(typeof COARSE_UNIFORM_NAMES)[number]>;
  private readonly terrain: TerrainTexture;
  private readonly framebuffer: WebGLFramebuffer;
  private readonly coarseTexture: WebGLTexture;
  private coarseWidth = 0;
  private coarseHeight = 0;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly fullScreenVertexArray: WebGLVertexArrayObject,
    private readonly weather: WeatherDataTextures,
  ) {
    this.program = linkProgram(gl, FULL_SCREEN_QUAD_VERTEX_SHADER, TERRAIN_LIGHT_FRAGMENT_SHADER);
    this.coarseProgram = linkProgram(gl, FULL_SCREEN_QUAD_VERTEX_SHADER, TERRAIN_COARSE_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, TERRAIN_UNIFORM_NAMES);
    this.coarseLocations = findUniforms(gl, this.coarseProgram, COARSE_UNIFORM_NAMES);
    this.terrain = new TerrainTexture(gl);
    this.framebuffer = gl.createFramebuffer()!;
    this.coarseTexture = gl.createTexture()!;
  }

  private sizeCoarse(factor: number, view: LitView): void {
    const { gl } = this;
    const width = Math.max(1, Math.ceil(view.width / factor));
    const height = Math.max(1, Math.ceil(view.height / factor));
    if (width === this.coarseWidth && height === this.coarseHeight) return;
    gl.bindTexture(gl.TEXTURE_2D, this.coarseTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    setTextureFiltering(gl, this.coarseTexture, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.coarseTexture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.coarseWidth = width;
    this.coarseHeight = height;
  }

  private bindTerrain(locations: UniformLocations<'uTerrain' | 'uTerrainParams' | 'uSwitch' | 'uCoarse'>, switches: readonly number[], factor: number): void {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_TERRAIN);
    gl.bindTexture(gl.TEXTURE_2D, this.terrain.texture);
    gl.uniform1i(locations.uTerrain, TEXTURE_UNIT_TERRAIN);
    gl.uniform4f(locations.uTerrainParams, setting('litTerrainScale', SLOPE_SCALE), setting('litTerrainReach', SLOPE_REACH_TILES), PEAK_METRES, 0);
    gl.uniform4f(locations.uSwitch, switches[0]!, switches[1]!, switches[2]!, switches[3]!);
    gl.uniform4f(locations.uCoarse, factor, this.coarseWidth, this.coarseHeight, 0);
  }

  draw(world: World, view: LitView, lighting: Lighting): void {
    const switches = terrainLightSwitches();
    if (switches.every((amount) => amount <= 0)) return;
    const { gl } = this;
    const factor = Math.max(1, Math.round(setting('litTerrainCoarse', COARSE_PIXELS)));
    this.terrain.update(world);
    this.sizeCoarse(factor, view);

    const coarse = this.coarseLocations;
    gl.useProgram(this.coarseProgram);
    gl.bindVertexArray(this.fullScreenVertexArray);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.coarseWidth, this.coarseHeight);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    setViewUniforms(gl, coarse, view);
    this.weather.bindTo(coarse as WeatherUniformLocations, world, view, lighting);
    this.bindTerrain(coarse, switches, factor);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, view.width, view.height);

    const { locations } = this;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.fullScreenVertexArray);
    useAlphaBlendingWithoutDepth(gl);
    setViewUniforms(gl, locations, view);
    this.weather.bindTo(locations as WeatherUniformLocations, world, view, lighting);
    this.bindTerrain(locations, switches, factor);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_TERRAIN_COARSE);
    gl.bindTexture(gl.TEXTURE_2D, this.coarseTexture);
    gl.uniform1i(locations.uCoarseLight, TEXTURE_UNIT_TERRAIN_COARSE);
    gl.uniform3fv(locations.uTone, TONE_VALUES);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
