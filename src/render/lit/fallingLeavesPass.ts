import type { World } from '../../sim/world.ts';
import type { UniformLocations } from './glHelpers.ts';
import { findUniforms, linkProgram, setViewUniforms, useAlphaBlendingWithoutDepth, zoomFade } from './glHelpers.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import { FALLING_LEAVES_FRAGMENT_SHADER, FALLING_LEAVES_VERTEX_SHADER } from './shaders/shaderSources.ts';
import { TEXTURE_UNIT_LEAF_AND_PETAL_SOURCES } from './textureUnits.ts';
import type { WeatherDataTextures, WeatherUniformLocations } from './weatherDataTextures.ts';
import { WEATHER_UNIFORM_NAMES } from './weatherDataTextures.ts';

const FALLING_LEAVES_UNIFORM_NAMES = ['uView', 'uBuffer', 'uTime', 'uFall', 'uBlow', 'uVisible', 'uCells', 'uSources', ...WEATHER_UNIFORM_NAMES] as const;

const LEAVES_FADE_IN_FROM_ZOOM = 5;
const LEAVES_FULLY_VISIBLE_AT_ZOOM = 11;
const NOTHING_FALLING = 0.01;
const CELL_TILES = 6;
const SLOTS_PER_CELL = 8;

export class FallingLeavesPass {
  private readonly program: WebGLProgram;
  private readonly locations: UniformLocations<(typeof FALLING_LEAVES_UNIFORM_NAMES)[number]>;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly fullScreenVertexArray: WebGLVertexArrayObject,
    private readonly weather: WeatherDataTextures,
  ) {
    this.program = linkProgram(gl, FALLING_LEAVES_VERTEX_SHADER, FALLING_LEAVES_FRAGMENT_SHADER);
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
    const reachX = view.width / 2 / view.zoom;
    const reachY = view.height / 2 / view.zoom;
    const firstColumn = Math.floor((view.centre.x - reachX) / CELL_TILES) - 1;
    const firstRow = Math.floor((view.centre.y - reachY) / CELL_TILES) - 1;
    const columns = Math.floor((view.centre.x + reachX) / CELL_TILES) + 1 - firstColumn + 1;
    const rows = Math.floor((view.centre.y + reachY) / CELL_TILES) + 1 - firstRow + 1;
    gl.uniform4f(locations.uCells, firstColumn, firstRow, columns, rows);
    this.weather.bindTo(locations as WeatherUniformLocations, world, view, lighting);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_LEAF_AND_PETAL_SOURCES);
    gl.bindTexture(gl.TEXTURE_2D, this.weather.leafAndPetalSourcesTexture);
    gl.uniform1i(locations.uSources, TEXTURE_UNIT_LEAF_AND_PETAL_SOURCES);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, columns * rows * SLOTS_PER_CELL);
  }
}
