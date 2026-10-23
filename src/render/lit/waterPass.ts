import type { World } from '../../sim/world.ts';
import type { UniformLocations } from './glHelpers.ts';
import { findUniforms, linkProgram, setViewUniforms, zoomFade } from './glHelpers.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import { RIVER_FLOATS_PER_VERTEX, riverMesh } from './riverMesh.ts';
import {
  FULL_SCREEN_QUAD_VERTEX_SHADER,
  LAKE_AND_SEA_FRAGMENT_SHADER,
  MAX_WATER_POKES,
  RIVER_FRAGMENT_SHADER,
  RIVER_VERTEX_SHADER,
} from './shaders/shaderSources.ts';
import { TEXTURE_UNIT_PAINTED_GROUND } from './textureUnits.ts';
import type { WeatherDataTextures, WeatherUniformLocations } from './weatherDataTextures.ts';
import { WEATHER_UNIFORM_NAMES } from './weatherDataTextures.ts';

const LAKE_UNIFORM_NAMES = ['uView', 'uBuffer', 'uTime', 'uVisible', 'uGround', 'uPoke', ...WEATHER_UNIFORM_NAMES] as const;
const RIVER_UNIFORM_NAMES = ['uView', 'uBuffer', 'uTime', 'uVisible', 'uGround', ...WEATHER_UNIFORM_NAMES] as const;

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
  private readonly riverVertexArray: WebGLVertexArrayObject;
  private readonly riverVertexBuffer: WebGLBuffer;
  private readonly riverIndexBuffer: WebGLBuffer;
  private riverIndexCount = 0;
  private riverMeshWorldSeed = -1;
  private paintedGroundTexture: WebGLTexture | null = null;
  private readonly pokes: Poke[] = [];

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly fullScreenVertexArray: WebGLVertexArrayObject,
    private readonly weather: WeatherDataTextures,
  ) {
    this.lakeProgram = linkProgram(gl, FULL_SCREEN_QUAD_VERTEX_SHADER, LAKE_AND_SEA_FRAGMENT_SHADER);
    this.riverProgram = linkProgram(gl, RIVER_VERTEX_SHADER, RIVER_FRAGMENT_SHADER);
    this.lakeLocations = findUniforms(gl, this.lakeProgram, LAKE_UNIFORM_NAMES);
    this.riverLocations = findUniforms(gl, this.riverProgram, RIVER_UNIFORM_NAMES);
    this.riverVertexArray = gl.createVertexArray()!;
    this.riverVertexBuffer = gl.createBuffer()!;
    this.riverIndexBuffer = gl.createBuffer()!;
  }

  throwRipple(x: number, y: number, seconds: number): void {
    this.pokes.push({ x, y, startedAtSeconds: seconds });
    while (this.pokes.length > MAX_WATER_POKES) this.pokes.shift();
  }

  draw(world: World, view: LitView, lighting: Lighting): void {
    const visible = zoomFade(view.zoom, WATER_FADES_IN_FROM_ZOOM, WATER_FADES_IN_FROM_ZOOM + WATER_SURFACE_ZOOM_RANGE);
    if (visible <= 0.01 || !view.ground) return;

    const { gl } = this;
    this.uploadRiverMeshIfWorldChanged(world);
    this.uploadPaintedGround(view.ground);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.STENCIL_TEST);
    gl.stencilMask(0xff);
    gl.stencilFunc(gl.EQUAL, 0, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);

    this.drawRivers(world, view, lighting, visible);

    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    this.drawLakesAndSea(world, view, lighting, visible);

    gl.disable(gl.STENCIL_TEST);
    gl.clear(gl.STENCIL_BUFFER_BIT);
  }

  private drawRivers(world: World, view: LitView, lighting: Lighting, visible: number): void {
    if (this.riverIndexCount === 0) return;
    const { gl } = this;
    const locations = this.riverLocations;
    gl.useProgram(this.riverProgram);
    gl.bindVertexArray(this.riverVertexArray);
    setViewUniforms(gl, locations, view);
    gl.uniform1f(locations.uTime, view.time);
    gl.uniform1f(locations.uVisible, visible);
    this.weather.bindTo(locations as WeatherUniformLocations, world, view, lighting);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_PAINTED_GROUND);
    gl.uniform1i(locations.uGround, TEXTURE_UNIT_PAINTED_GROUND);
    gl.drawElements(gl.TRIANGLES, this.riverIndexCount, gl.UNSIGNED_INT, 0);
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

  private uploadPaintedGround(ground: HTMLCanvasElement): void {
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

  private uploadRiverMeshIfWorldChanged(world: World): void {
    if (this.riverMeshWorldSeed === world.seed) return;
    this.riverMeshWorldSeed = world.seed;

    const { gl } = this;
    const mesh = riverMesh(world.field.rivers.segments, world.field.height, world.field.water, world.grid);
    gl.bindVertexArray(this.riverVertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.riverVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.riverIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    const strideBytes = RIVER_FLOATS_PER_VERTEX * 4;
    const attributeLayout: readonly (readonly [number, number, number])[] = [
      [0, 2, 0],
      [1, 2, 8],
      [2, 2, 16],
      [3, 4, 24],
    ];
    for (const [location, componentCount, byteOffset] of attributeLayout) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, componentCount, gl.FLOAT, false, strideBytes, byteOffset);
    }
    gl.bindVertexArray(null);
    this.riverIndexCount = mesh.indices.length;
  }
}
