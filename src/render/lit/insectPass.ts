import { INSECT_CELL_TILES, INSECT_CLICKS, INSECT_COUNT, INSECT_SLOTS, INSECT_STARTS, INSECTS } from '../../sim/insects/species.ts';
import { habitatAt } from '../../sim/fauna/habitat/insectHabitat.ts';
import { southernSeasonPhaseOf } from '../../sim/astro.ts';
import type { World } from '../../sim/world.ts';
import type { UniformLocations } from './glHelpers.ts';
import { findUniforms, linkProgram, setViewUniforms, useAlphaBlendingWithoutDepth } from './glHelpers.ts';
import { FAUNA_COLUMNS, FAUNA_ROWS, PATCH_TILES } from '../../sim/fauna/life.ts';
import type { FaunaTexture } from './faunaTexture.ts';
import { HabitatTexture } from './habitatTexture.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import { INSECT_FRAGMENT_SHADER, INSECT_VERTEX_SHADER } from './shaders/shaderSources.ts';
import { TEXTURE_UNIT_INSECT_HABITAT, TEXTURE_UNIT_PAINTED_GROUND, TEXTURE_UNIT_FAUNA } from './textureUnits.ts';
import type { WeatherDataTextures, WeatherUniformLocations } from './weatherDataTextures.ts';
import { WEATHER_UNIFORM_NAMES } from './weatherDataTextures.ts';

const INSECT_UNIFORM_NAMES = ['uView', 'uBuffer', 'uTime', 'uVisible', 'uCells', 'uLayer', 'uYear', 'uSpecies', 'uSlotStart', 'uClick', 'uHabitat', 'uGround', 'uFauna', 'uFaunaRect', ...WEATHER_UNIFORM_NAMES] as const;

export const INSECTS_FROM_ZOOM = 30;

export const AIR = 1;
export const GROUND = 0;

function speciesTable(): Float32Array {
  const table = new Float32Array(INSECT_COUNT * 24);
  INSECTS.forEach((s, id) => {
    table.set(
      [
        ...s.likes,
        ...s.temperature,
        ...s.season,
        s.day, s.night, s.dusk, s.wind,
        s.length, s.motion, s.rain, 0,
        ...s.colour, s.airborne ? AIR : GROUND,
      ],
      id * 24,
    );
  });
  return table;
}

export class InsectPass {
  private readonly program: WebGLProgram;
  private readonly locations: UniformLocations<(typeof INSECT_UNIFORM_NAMES)[number]>;
  private readonly habitat: HabitatTexture;
  private readonly table = speciesTable();
  private readonly slots = Float32Array.from(INSECT_STARTS);
  private readonly clicks = Float32Array.from({ length: INSECT_CLICKS * 3 }, (_, index) => (index % 3 === 2 ? -1e9 : 0));

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly cornersVertexArray: WebGLVertexArrayObject,
    private readonly weather: WeatherDataTextures,
    private readonly fauna: FaunaTexture,
  ) {
    this.program = linkProgram(gl, INSECT_VERTEX_SHADER, INSECT_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, INSECT_UNIFORM_NAMES);
    this.habitat = new HabitatTexture(gl, habitatAt);
  }

  startle(x: number, y: number, seconds: number): void {
    this.clicks.copyWithin(0, 3);
    this.clicks.set([x, y, seconds], (INSECT_CLICKS - 1) * 3);
  }

  prepare(world: World, view: LitView): void {
    if (view.zoom < INSECTS_FROM_ZOOM) return;
    this.habitat.step(world, world.grid.row(view.centre.y));
  }

  draw(world: World, view: LitView, lighting: Lighting, layer: number): void {
    if (!this.fauna.texture) return;
    if (view.zoom < INSECTS_FROM_ZOOM || !this.habitat.texture) return;
    const visible = 1;

    const { gl, locations } = this;
    const reachX = view.width / 2 / view.zoom + INSECT_CELL_TILES;
    const reachY = view.height / 2 / view.zoom + INSECT_CELL_TILES;
    const firstColumn = Math.floor((view.centre.x - reachX) / INSECT_CELL_TILES);
    const firstRow = Math.floor((view.centre.y - reachY) / INSECT_CELL_TILES);
    const columns = Math.floor((view.centre.x + reachX) / INSECT_CELL_TILES) - firstColumn + 1;
    const rows = Math.floor((view.centre.y + reachY) / INSECT_CELL_TILES) - firstRow + 1;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.cornersVertexArray);
    useAlphaBlendingWithoutDepth(gl);
    setViewUniforms(gl, locations, view);
    gl.uniform1f(locations.uTime, view.time);
    gl.uniform1f(locations.uVisible, visible);
    gl.uniform1f(locations.uLayer, layer);
    gl.uniform4f(locations.uCells, firstColumn, firstRow, columns, rows);
    gl.uniform2f(locations.uYear, lighting.moment.seasonPhase, southernSeasonPhaseOf(lighting.moment.seasonPhase));
    gl.uniform4fv(locations.uSpecies, this.table);
    gl.uniform1fv(locations.uSlotStart, this.slots);
    this.weather.bindTo(locations as WeatherUniformLocations, world, view, lighting);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_FAUNA);
    gl.bindTexture(gl.TEXTURE_2D, this.fauna.texture);
    gl.uniform1i(locations.uFauna, TEXTURE_UNIT_FAUNA);
    gl.uniform4f(locations.uFaunaRect, world.grid.minX, world.grid.minY, FAUNA_COLUMNS * PATCH_TILES, FAUNA_ROWS * PATCH_TILES);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_INSECT_HABITAT);
    gl.bindTexture(gl.TEXTURE_2D, this.habitat.texture);
    gl.uniform3fv(locations.uClick, this.clicks);
    gl.uniform1i(locations.uHabitat, TEXTURE_UNIT_INSECT_HABITAT);
    gl.uniform1i(locations.uGround, TEXTURE_UNIT_PAINTED_GROUND);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, columns * rows * INSECT_SLOTS.length * 2);
  }
}
