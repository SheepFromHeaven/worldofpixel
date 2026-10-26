import { AMPHIBIAN_CELL_TILES, AMPHIBIAN_COUNT, AMPHIBIAN_SLOTS, AMPHIBIAN_STARTS, AMPHIBIANS } from '../../sim/amphibians/species.ts';
import { southernSeasonPhaseOf } from '../../sim/astro.ts';
import { INSECT_CLICKS } from '../../sim/insects/species.ts';
import type { World } from '../../sim/world.ts';
import { amphibianHabitatAt } from '../../sim/fauna/habitat/amphibianHabitat.ts';
import type { UniformLocations } from './glHelpers.ts';
import { SORTED_WITH_PROPS } from './litLayerConstants.ts';
import { findUniforms, linkProgram, setViewUniforms, useAlphaBlendingForLayer } from './glHelpers.ts';
import { FAUNA_COLUMNS, FAUNA_ROWS, PATCH_TILES } from '../../sim/fauna/life.ts';
import type { FaunaTexture } from './faunaTexture.ts';
import { HabitatTexture } from './habitatTexture.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import { AMPHIBIAN_FRAGMENT_SHADER, AMPHIBIAN_VERTEX_SHADER } from './shaders/shaderSources.ts';
import { TEXTURE_UNIT_AMPHIBIAN_HABITAT, TEXTURE_UNIT_PAINTED_GROUND, TEXTURE_UNIT_FAUNA } from './textureUnits.ts';
import type { WeatherDataTextures, WeatherUniformLocations } from './weatherDataTextures.ts';
import { WEATHER_UNIFORM_NAMES } from './weatherDataTextures.ts';
import type { ZooState } from './zoo.ts';
import { bindZoo, ZooProbe, zooCells, ZOO_UNIFORM_NAMES } from './zoo.ts';
import type { Vec2 } from '../../sim/geometry.ts';

const AMPHIBIAN_UNIFORM_NAMES = ['uView', 'uBuffer', 'uTime', 'uVisible', 'uCells', 'uLayer', 'uYear', 'uSpecies', 'uSlotStart', 'uClick', 'uHabitat', 'uGround', 'uFauna', 'uFaunaRect', ...ZOO_UNIFORM_NAMES, ...WEATHER_UNIFORM_NAMES] as const;

export const AMPHIBIANS_FROM_ZOOM = 24;


const VEC4S_PER_SPECIES = 12;

function speciesTable(): Float32Array {
  const table = new Float32Array(AMPHIBIAN_COUNT * VEC4S_PER_SPECIES * 4);
  AMPHIBIANS.forEach((s, id) => {
    table.set(
      [
        ...s.likes,
        ...s.temperature,
        ...s.season,
        s.day, s.night, s.dusk, s.wet,
        s.length, s.form, s.pattern, s.gait,
        ...s.colour, s.spots,
        ...s.accent, s.canopy ? 1 : 0,
        ...s.eye, s.bias,
        ...s.spawn,
        ...s.larva,
        ...s.water,
        s.adults, s.young, s.clutch, s.rest,
      ],
      id * VEC4S_PER_SPECIES * 4,
    );
  });
  return table;
}

export class AmphibianPass {
  private readonly program: WebGLProgram;
  private readonly locations: UniformLocations<(typeof AMPHIBIAN_UNIFORM_NAMES)[number]>;
  private readonly habitat: HabitatTexture;
  private readonly table = speciesTable();
  private readonly slots = Float32Array.from(AMPHIBIAN_STARTS);
  private readonly clicks = Float32Array.from({ length: INSECT_CLICKS * 3 }, (_, index) => (index % 3 === 2 ? -1e9 : 0));

  zoo: ZooState | null = null;
  private readonly probeProgram: WebGLProgram;
  private readonly probeLocations: UniformLocations<(typeof AMPHIBIAN_UNIFORM_NAMES)[number]>;
  private readonly feedback: ZooProbe;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly cornersVertexArray: WebGLVertexArrayObject,
    private readonly weather: WeatherDataTextures,
    private readonly fauna: FaunaTexture,
  ) {
    this.program = linkProgram(gl, AMPHIBIAN_VERTEX_SHADER, AMPHIBIAN_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, AMPHIBIAN_UNIFORM_NAMES);
    this.probeProgram = linkProgram(gl, AMPHIBIAN_VERTEX_SHADER, AMPHIBIAN_FRAGMENT_SHADER, ['gl_Position']);
    this.probeLocations = findUniforms(gl, this.probeProgram, AMPHIBIAN_UNIFORM_NAMES);
    this.feedback = new ZooProbe(gl);
    this.habitat = new HabitatTexture(gl, amphibianHabitatAt, gl.NEAREST);
  }

  startle(x: number, y: number, seconds: number): void {
    this.clicks.copyWithin(0, 3);
    this.clicks.set([x, y, seconds], (INSECT_CLICKS - 1) * 3);
  }

  prepare(world: World, view: LitView): void {
    if (view.zoom < AMPHIBIANS_FROM_ZOOM) return;
    this.habitat.step(world, world.grid.row(view.centre.y));
  }

  draw(world: World, view: LitView, lighting: Lighting, layer: number): void {
    this.render(world, view, lighting, layer, false);
  }

  probe(world: World, view: LitView, lighting: Lighting): Vec2 | null {
    return this.zoo ? this.render(world, view, lighting, SORTED_WITH_PROPS, true) : null;
  }

  private render(world: World, view: LitView, lighting: Lighting, layer: number, probing: boolean): Vec2 | null {
    if (!this.fauna.texture) return null;
    if (view.zoom < AMPHIBIANS_FROM_ZOOM || !this.habitat.texture) return null;

    const { gl } = this;
    const locations = probing ? this.probeLocations : this.locations;
    const reachX = view.width / 2 / view.zoom + AMPHIBIAN_CELL_TILES;
    const reachY = view.height / 2 / view.zoom + AMPHIBIAN_CELL_TILES;
    const firstColumn = Math.floor((view.centre.x - reachX) / AMPHIBIAN_CELL_TILES);
    const firstRow = Math.floor((view.centre.y - reachY) / AMPHIBIAN_CELL_TILES);
    const columns = Math.floor((view.centre.x + reachX) / AMPHIBIAN_CELL_TILES) - firstColumn + 1;
    const rows = Math.floor((view.centre.y + reachY) / AMPHIBIAN_CELL_TILES) - firstRow + 1;
    const cells = this.zoo ? zooCells(this.zoo, AMPHIBIAN_CELL_TILES) : [firstColumn, firstRow, columns, rows];

    gl.useProgram(probing ? this.probeProgram : this.program);
    gl.bindVertexArray(this.cornersVertexArray);
    if (!probing) useAlphaBlendingForLayer(gl, layer === SORTED_WITH_PROPS);
    setViewUniforms(gl, locations, view);
    gl.uniform1f(locations.uTime, view.time);
    gl.uniform1f(locations.uVisible, 1);
    gl.uniform1f(locations.uLayer, layer);
    gl.uniform4f(locations.uCells, cells[0]!, cells[1]!, cells[2]!, cells[3]!);
    bindZoo(gl, locations, this.zoo, AMPHIBIAN_CELL_TILES);
    gl.uniform2f(locations.uYear, lighting.moment.seasonPhase, southernSeasonPhaseOf(lighting.moment.seasonPhase));
    gl.uniform4fv(locations.uSpecies, this.table);
    gl.uniform1fv(locations.uSlotStart, this.slots);
    this.weather.bindTo(locations as WeatherUniformLocations, world, view, lighting);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_FAUNA);
    gl.bindTexture(gl.TEXTURE_2D, this.fauna.texture);
    gl.uniform1i(locations.uFauna, TEXTURE_UNIT_FAUNA);
    gl.uniform4f(locations.uFaunaRect, world.grid.minX, world.grid.minY, FAUNA_COLUMNS * PATCH_TILES, FAUNA_ROWS * PATCH_TILES);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_AMPHIBIAN_HABITAT);
    gl.bindTexture(gl.TEXTURE_2D, this.habitat.texture);
    gl.uniform3fv(locations.uClick, this.clicks);
    gl.uniform1i(locations.uHabitat, TEXTURE_UNIT_AMPHIBIAN_HABITAT);
    gl.uniform1i(locations.uGround, TEXTURE_UNIT_PAINTED_GROUND);
    const count = cells[2]! * cells[3]! * AMPHIBIAN_SLOTS * 2;
    const draw = (): void => gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    if (probing) return this.feedback.read(count, draw, view);
    draw();
    gl.depthMask(true);
    return null;
  }
}
