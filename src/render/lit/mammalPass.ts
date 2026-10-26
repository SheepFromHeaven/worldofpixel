import { southernSeasonPhaseOf } from '../../sim/astro.ts';
import { INSECT_CLICKS } from '../../sim/insects/species.ts';
import { PREDATOR_COUNT, PREDATORS } from '../../sim/mammals/predators.ts';
import { MAMMAL_CELL_TILES, MAMMAL_COUNT, MAMMAL_SLOTS, MAMMAL_STARTS, MAMMAL_TABLE_WIDTH, MAMMALS, tableRow } from '../../sim/mammals/species.ts';
import type { World } from '../../sim/world.ts';
import { mammalHabitatAt } from '../../sim/fauna/habitat/mammalHabitat.ts';
import type { UniformLocations } from './glHelpers.ts';
import { SORTED_WITH_PROPS } from './litLayerConstants.ts';
import { findUniforms, linkProgram, setViewUniforms, useAlphaBlendingForLayer } from './glHelpers.ts';
import { FAUNA_COLUMNS, FAUNA_ROWS, lifeOf, PATCH_TILES } from '../../sim/fauna/life.ts';
import type { FaunaTexture } from './faunaTexture.ts';
import { HabitatTexture } from './habitatTexture.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import { MAMMAL_FRAGMENT_SHADER, MAMMAL_VERTEX_SHADER } from './shaders/shaderSources.ts';
import { TEXTURE_UNIT_PAINTED_GROUND, TEXTURE_UNIT_MAMMAL_HABITAT, TEXTURE_UNIT_MAMMAL_TABLE, TEXTURE_UNIT_FAUNA } from './textureUnits.ts';
import type { WeatherDataTextures, WeatherUniformLocations } from './weatherDataTextures.ts';
import { WEATHER_UNIFORM_NAMES } from './weatherDataTextures.ts';

const MAMMAL_UNIFORM_NAMES = ['uView', 'uBuffer', 'uTime', 'uVisible', 'uCells', 'uLayer', 'uYear', 'uTable', 'uSlotStart', 'uPredator', 'uClick', 'uHabitat', 'uGround', 'uFauna', 'uFaunaRect', ...WEATHER_UNIFORM_NAMES] as const;

export const MAMMALS_FROM_ZOOM = 3;


const MARGIN_CELLS = 3;

const dietOf = (key: string): number => {
  const plant = lifeOf(key).plant[2]!;
  return plant >= 0.7 ? 1 : plant >= 0.3 ? 2 : 0;
};

function speciesTable(gl: WebGL2RenderingContext): WebGLTexture {
  const data = new Float32Array(MAMMAL_TABLE_WIDTH * MAMMAL_COUNT * 4);
  MAMMALS.forEach((species, id) => data.set(tableRow(species, dietOf(species.key)), id * MAMMAL_TABLE_WIDTH * 4));
  const texture = gl.createTexture();
  if (!texture) throw new Error('could not create a texture');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, MAMMAL_TABLE_WIDTH, MAMMAL_COUNT, 0, gl.RGBA, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

export class MammalPass {
  private readonly program: WebGLProgram;
  private readonly locations: UniformLocations<(typeof MAMMAL_UNIFORM_NAMES)[number]>;
  private readonly habitat: HabitatTexture;
  private readonly table: WebGLTexture;
  private readonly slots = Float32Array.from(MAMMAL_STARTS);
  private readonly predators = Float32Array.from({ length: PREDATOR_COUNT }, (_, i) => PREDATORS[i] ?? 0);
  private readonly clicks = Float32Array.from({ length: INSECT_CLICKS * 3 }, (_, index) => (index % 3 === 2 ? -1e9 : 0));

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly cornersVertexArray: WebGLVertexArrayObject,
    private readonly weather: WeatherDataTextures,
    private readonly fauna: FaunaTexture,
  ) {
    this.program = linkProgram(gl, MAMMAL_VERTEX_SHADER, MAMMAL_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, MAMMAL_UNIFORM_NAMES);
    this.habitat = new HabitatTexture(gl, mammalHabitatAt, gl.NEAREST);
    this.table = speciesTable(gl);
  }

  startle(x: number, y: number, seconds: number): void {
    this.clicks.copyWithin(0, 3);
    this.clicks.set([x, y, seconds], (INSECT_CLICKS - 1) * 3);
  }

  prepare(world: World, view: LitView): void {
    if (view.zoom < MAMMALS_FROM_ZOOM) return;
    this.habitat.step(world, world.grid.row(view.centre.y));
  }

  draw(world: World, view: LitView, lighting: Lighting, layer: number): void {
    if (!this.fauna.texture) return;
    if (view.zoom < MAMMALS_FROM_ZOOM || !this.habitat.texture) return;

    const { gl, locations } = this;
    const reachX = view.width / 2 / view.zoom + MAMMAL_CELL_TILES * MARGIN_CELLS;
    const reachY = view.height / 2 / view.zoom + MAMMAL_CELL_TILES * MARGIN_CELLS;
    const firstColumn = Math.floor((view.centre.x - reachX) / MAMMAL_CELL_TILES);
    const firstRow = Math.floor((view.centre.y - reachY) / MAMMAL_CELL_TILES);
    const columns = Math.floor((view.centre.x + reachX) / MAMMAL_CELL_TILES) - firstColumn + 1;
    const rows = Math.floor((view.centre.y + reachY) / MAMMAL_CELL_TILES) - firstRow + 1;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.cornersVertexArray);
    useAlphaBlendingForLayer(gl, layer === SORTED_WITH_PROPS);
    setViewUniforms(gl, locations, view);
    gl.uniform1f(locations.uTime, view.time);
    gl.uniform1f(locations.uVisible, 1);
    gl.uniform1f(locations.uLayer, layer);
    gl.uniform4f(locations.uCells, firstColumn, firstRow, columns, rows);
    gl.uniform2f(locations.uYear, lighting.moment.seasonPhase, southernSeasonPhaseOf(lighting.moment.seasonPhase));
    gl.uniform1fv(locations.uSlotStart, this.slots);
    gl.uniform1fv(locations.uPredator, this.predators);
    this.weather.bindTo(locations as WeatherUniformLocations, world, view, lighting);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_FAUNA);
    gl.bindTexture(gl.TEXTURE_2D, this.fauna.texture);
    gl.uniform1i(locations.uFauna, TEXTURE_UNIT_FAUNA);
    gl.uniform4f(locations.uFaunaRect, world.grid.minX, world.grid.minY, FAUNA_COLUMNS * PATCH_TILES, FAUNA_ROWS * PATCH_TILES);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_MAMMAL_HABITAT);
    gl.bindTexture(gl.TEXTURE_2D, this.habitat.texture);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_MAMMAL_TABLE);
    gl.bindTexture(gl.TEXTURE_2D, this.table);
    gl.uniform3fv(locations.uClick, this.clicks);
    gl.uniform1i(locations.uHabitat, TEXTURE_UNIT_MAMMAL_HABITAT);
    gl.uniform1i(locations.uTable, TEXTURE_UNIT_MAMMAL_TABLE);
    gl.uniform1i(locations.uGround, TEXTURE_UNIT_PAINTED_GROUND);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, columns * rows * MAMMAL_SLOTS * 2);
    gl.depthMask(true);
  }
}
