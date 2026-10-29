import type { World } from '../../sim/world.ts';
import type { UniformLocations } from './glHelpers.ts';
import { findUniforms, linkProgram, setViewUniforms, zoomFade } from './glHelpers.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import { RiverField } from './riverField.ts';
import {
  FULL_SCREEN_QUAD_VERTEX_SHADER,
  LAKE_AND_SEA_FRAGMENT_SHADER,
  MAX_WATER_POKES,
  RIVER_FRAGMENT_SHADER,
} from './shaders/shaderSources.ts';
import { TEXTURE_UNIT_PAINTED_GROUND, TEXTURE_UNIT_RIVER_FIELD, TEXTURE_UNIT_RIVER_ROCKS } from './textureUnits.ts';
import type { WeatherDataTextures, WeatherUniformLocations } from './weatherDataTextures.ts';
import { WEATHER_UNIFORM_NAMES } from './weatherDataTextures.ts';

const LAKE_UNIFORM_NAMES = ['uView', 'uBuffer', 'uTime', 'uVisible', 'uGround', 'uPoke', ...WEATHER_UNIFORM_NAMES] as const;
const RIVER_UNIFORM_NAMES = ['uView', 'uBuffer', 'uTime', 'uVisible', 'uGround', 'uRiverField', 'uRiverRocks', 'uRiverRect', 'uFoamPass', ...WEATHER_UNIFORM_NAMES] as const;

const WATER_FADES_IN_FROM_ZOOM = 2.5;
const WATER_FULLY_VISIBLE_AT_ZOOM = 6.5;
const WATER_SURFACE_ZOOM_RANGE = WATER_FULLY_VISIBLE_AT_ZOOM - WATER_FADES_IN_FROM_ZOOM;

interface Poke {
  x: number;
  y: number;
  startedAtSeconds: number;
}

export class WaterPass {
  private readonly lakeProgram: WebGLProgram;
  private readonly riverProgram: WebGLProgram;
  private readonly lakeLocations: UniformLocations<(typeof LAKE_UNIFORM_NAMES)[number]>;
  private readonly riverLocations: UniformLocations<(typeof RIVER_UNIFORM_NAMES)[number]>;
  private readonly riverField: RiverField;
  private paintedGroundTexture: WebGLTexture | null = null;
  private readonly pokes: Poke[] = [];

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly fullScreenVertexArray: WebGLVertexArrayObject,
    private readonly weather: WeatherDataTextures,
  ) {
    this.lakeProgram = linkProgram(gl, FULL_SCREEN_QUAD_VERTEX_SHADER, LAKE_AND_SEA_FRAGMENT_SHADER);
    this.riverProgram = linkProgram(gl, FULL_SCREEN_QUAD_VERTEX_SHADER, RIVER_FRAGMENT_SHADER);
    this.lakeLocations = findUniforms(gl, this.lakeProgram, LAKE_UNIFORM_NAMES);
    this.riverLocations = findUniforms(gl, this.riverProgram, RIVER_UNIFORM_NAMES);
    this.riverField = new RiverField(gl);
  }

  throwRipple(x: number, y: number, seconds: number): void {
    this.pokes.push({ x, y, startedAtSeconds: seconds });
    while (this.pokes.length > MAX_WATER_POKES) this.pokes.shift();
  }

  draw(world: World, view: LitView, lighting: Lighting): void {
    const visible = zoomFade(view.zoom, WATER_FADES_IN_FROM_ZOOM, WATER_FADES_IN_FROM_ZOOM + WATER_SURFACE_ZOOM_RANGE);
    if (visible <= 0.01 || !view.ground) return;

    const { gl } = this;
    const riversReady = this.riverField.update(world, view);
    this.uploadPaintedGround(view.ground);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.STENCIL_TEST);

    this.drawLakesAndSea(world, view, lighting, visible);
    if (riversReady) this.drawRivers(world, view, lighting, visible, false);
    if (riversReady) this.drawRivers(world, view, lighting, visible, true);
  }

  private drawRivers(world: World, view: LitView, lighting: Lighting, visible: number, foam: boolean): void {
    const { gl } = this;
    const locations = this.riverLocations;
    gl.useProgram(this.riverProgram);
    gl.bindVertexArray(this.fullScreenVertexArray);
    setViewUniforms(gl, locations, view);
    gl.uniform1f(locations.uTime, view.time);
    gl.uniform1f(locations.uVisible, visible);
    gl.uniform1f(locations.uFoamPass, foam ? 1 : 0);
    this.weather.bindTo(locations as WeatherUniformLocations, world, view, lighting);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_PAINTED_GROUND);
    gl.uniform1i(locations.uGround, TEXTURE_UNIT_PAINTED_GROUND);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_RIVER_FIELD);
    gl.bindTexture(gl.TEXTURE_2D, this.riverField.flowTexture);
    gl.uniform1i(locations.uRiverField, TEXTURE_UNIT_RIVER_FIELD);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_RIVER_ROCKS);
    gl.bindTexture(gl.TEXTURE_2D, this.riverField.rockTexture);
    gl.uniform1i(locations.uRiverRocks, TEXTURE_UNIT_RIVER_ROCKS);
    const { rect } = this.riverField;
    gl.uniform4f(locations.uRiverRect, rect.x, rect.y, rect.size, rect.size);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private drawLakesAndSea(world: World, view: LitView, lighting: Lighting, visible: number): void {
    const { gl } = this;
    const locations = this.lakeLocations;
    gl.useProgram(this.lakeProgram);
    gl.bindVertexArray(this.fullScreenVertexArray);
    setViewUniforms(gl, locations, view);
    gl.uniform1f(locations.uTime, view.time);
    gl.uniform1f(locations.uVisible, visible);

    const ripples = new Float32Array(MAX_WATER_POKES * 4);
    this.pokes.forEach((poke, index) => ripples.set([poke.x, poke.y, poke.startedAtSeconds, 1], index * 4));
    gl.uniform4fv(locations.uPoke, ripples);

    this.weather.bindTo(locations as WeatherUniformLocations, world, view, lighting);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_PAINTED_GROUND);
    gl.uniform1i(locations.uGround, TEXTURE_UNIT_PAINTED_GROUND);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  uploadPaintedGround(ground: HTMLCanvasElement): void {
    const { gl } = this;
    this.paintedGroundTexture ??= gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_PAINTED_GROUND);
    gl.bindTexture(gl.TEXTURE_2D, this.paintedGroundTexture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ground);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
}
