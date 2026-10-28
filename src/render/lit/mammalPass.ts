import { nearestSeenZoom } from './animalSight.ts';
import { southernSeasonPhaseOf } from '../../sim/astro.ts';
import { INSECT_CLICKS } from '../../sim/insects/species.ts';
import { PREDATOR_COUNT, PREDATORS } from '../../sim/mammals/predators.ts';
import { AGENT_CAPACITY, AGENT_FLOATS } from './mammalAgents.ts';
import type { MammalAgents } from './mammalAgents.ts';
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
import type { ZooState } from './zoo.ts';
import { bindZoo, ZooProbe, zooCells, ZOO_UNIFORM_NAMES } from './zoo.ts';
import type { Vec2 } from '../../sim/geometry.ts';

const MAMMAL_UNIFORM_NAMES = ['uView', 'uBuffer', 'uTime', 'uVisible', 'uCells', 'uLayer', 'uYear', 'uTable', 'uAgents', 'uSlotStart', 'uPredator', 'uClick', 'uHabitat', 'uGround', 'uFauna', 'uFaunaRect', 'uXray', ...ZOO_UNIFORM_NAMES, ...WEATHER_UNIFORM_NAMES] as const;

export const MAMMALS_FROM_ZOOM = nearestSeenZoom(MAMMALS.map((species) => species.length));


const MARGIN_CELLS = 3;

const XRAY_KEY_BIAS = 1;

const dietOf = (key: string): number => {
  const plant = lifeOf(key).plant[2]!;
  return plant >= 0.7 ? 1 : plant >= 0.3 ? 2 : 0;
};

function speciesTable(gl: WebGL2RenderingContext): WebGLTexture {
  const data = new Float32Array(MAMMAL_TABLE_WIDTH * (MAMMAL_COUNT + AGENT_CAPACITY) * 4);
  MAMMALS.forEach((species, id) => data.set(tableRow(species, dietOf(species.key)), id * MAMMAL_TABLE_WIDTH * 4));
  const texture = gl.createTexture();
  if (!texture) throw new Error('could not create a texture');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, MAMMAL_TABLE_WIDTH, MAMMAL_COUNT + AGENT_CAPACITY, 0, gl.RGBA, gl.FLOAT, data);
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

  zoo: ZooState | null = null;
  agents: MammalAgents | null = null;
  private readonly probeProgram: WebGLProgram;
  private readonly probeLocations: UniformLocations<(typeof MAMMAL_UNIFORM_NAMES)[number]>;
  private readonly feedback: ZooProbe;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly cornersVertexArray: WebGLVertexArrayObject,
    private readonly weather: WeatherDataTextures,
    private readonly fauna: FaunaTexture,
  ) {
    this.program = linkProgram(gl, MAMMAL_VERTEX_SHADER, MAMMAL_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, MAMMAL_UNIFORM_NAMES);
    this.probeProgram = linkProgram(gl, MAMMAL_VERTEX_SHADER, MAMMAL_FRAGMENT_SHADER, ['gl_Position']);
    this.probeLocations = findUniforms(gl, this.probeProgram, MAMMAL_UNIFORM_NAMES);
    this.feedback = new ZooProbe(gl);
    this.habitat = new HabitatTexture(gl, mammalHabitatAt, gl.NEAREST);
    this.table = speciesTable(gl);
  }

  setAgents(agents: MammalAgents | null): void {
    this.agents = agents;
    if (!agents || agents.count === 0) return;
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_MAMMAL_TABLE);
    gl.bindTexture(gl.TEXTURE_2D, this.table);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, MAMMAL_COUNT, 5, agents.count, gl.RGBA, gl.FLOAT, agents.data.subarray(0, agents.count * AGENT_FLOATS));
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
    this.render(world, view, lighting, layer, false);
  }

  drawThrough(world: World, view: LitView, lighting: Lighting): void {
    this.render(world, view, lighting, SORTED_WITH_PROPS, false, true);
  }

  probe(world: World, view: LitView, lighting: Lighting): Vec2 | null {
    return this.zoo ? this.render(world, view, lighting, SORTED_WITH_PROPS, true) : null;
  }

  private render(world: World, view: LitView, lighting: Lighting, layer: number, probing: boolean, through = false): Vec2 | null {
    if (!this.fauna.texture) return null;
    if (view.zoom < MAMMALS_FROM_ZOOM || !this.habitat.texture) return null;

    const { gl } = this;
    const locations = probing ? this.probeLocations : this.locations;
    const reachX = view.width / 2 / view.zoom + MAMMAL_CELL_TILES * MARGIN_CELLS;
    const reachY = view.height / 2 / view.zoom + MAMMAL_CELL_TILES * MARGIN_CELLS;
    const firstColumn = Math.floor((view.centre.x - reachX) / MAMMAL_CELL_TILES);
    const firstRow = Math.floor((view.centre.y - reachY) / MAMMAL_CELL_TILES);
    const columns = Math.floor((view.centre.x + reachX) / MAMMAL_CELL_TILES) - firstColumn + 1;
    const rows = Math.floor((view.centre.y + reachY) / MAMMAL_CELL_TILES) - firstRow + 1;
    const { agents } = this;
    const cells = this.zoo ? zooCells(this.zoo, MAMMAL_CELL_TILES) : [firstColumn, firstRow, columns, rows];

    gl.useProgram(probing ? this.probeProgram : this.program);
    gl.bindVertexArray(this.cornersVertexArray);
    if (!probing) useAlphaBlendingForLayer(gl, layer === SORTED_WITH_PROPS);
    if (through) gl.depthFunc(gl.GREATER);
    gl.uniform1f(locations.uXray, through ? XRAY_KEY_BIAS : 0);
    setViewUniforms(gl, locations, view);
    gl.uniform1f(locations.uTime, view.time);
    gl.uniform1f(locations.uVisible, 1);
    gl.uniform1f(locations.uLayer, layer);
    gl.uniform4f(locations.uCells, cells[0]!, cells[1]!, cells[2]!, cells[3]!);
    bindZoo(gl, locations, this.zoo, MAMMAL_CELL_TILES);
    gl.uniform4f(locations.uAgents, agents ? 1 : 0, agents?.count ?? 0, agents?.isolated ? 1 : 0, 0);
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
    const count = agents ? agents.count * 2 : cells[2]! * cells[3]! * MAMMAL_SLOTS * 2;
    const draw = (): void => gl.drawArraysInstanced(probing ? gl.POINTS : gl.TRIANGLE_STRIP, 0, 4, count);
    if (probing) return this.feedback.read(count, draw, view);
    draw();
    if (through) gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    return null;
  }
}
