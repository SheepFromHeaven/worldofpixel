import { nearestSeenZoom } from '../../render/lit/animalSight.ts';
import { INSECT_CELL_TILES, INSECT_CLICKS, INSECT_COUNT, INSECT_SLOTS, INSECT_STARTS, INSECTS, WIND_SHELTER } from './api.ts';
import { GROUP_BASE, LIVES } from '../fauna/api.ts';
import { habitatAt } from './habitat.ts';
import { southernSeasonPhaseOf } from '../../sim/astro.ts';
import type { World } from '../../sim/world.ts';
import type { UniformLocations } from '../../render/lit/glHelpers.ts';
import { SORTED_WITH_PROPS } from '../../render/lit/litLayerConstants.ts';
import { findUniforms, linkProgram, setViewUniforms, useAlphaBlendingForLayer } from '../../render/lit/glHelpers.ts';
import { FAUNA_COLUMNS, FAUNA_ROWS, PATCH_TILES } from '../fauna/api.ts';
import type { FaunaTexture } from '../../render/lit/faunaTexture.ts';
import { HabitatTexture } from '../../render/lit/habitatTexture.ts';
import type { Lighting } from '../../render/lit/lighting.ts';
import type { LitView } from '../../render/lit/litLayer.ts';
import { assembleShader, asFloatLiteral } from '../../render/lit/shaders/shaderSources.ts';
import insectsFragment from './shaders/insects.frag?raw';
import insectsVertex from './shaders/insects.vert?raw';
import { TEXTURE_UNIT_INSECT_HABITAT, TEXTURE_UNIT_PAINTED_GROUND, TEXTURE_UNIT_FAUNA } from '../../render/lit/textureUnits.ts';
import type { WeatherDataTextures, WeatherUniformLocations } from '../../render/lit/weatherDataTextures.ts';
import { WEATHER_UNIFORM_NAMES } from '../../render/lit/weatherDataTextures.ts';
import type { ZooState } from '../../render/lit/zoo.ts';
import { bindZoo, ZooProbe, zooCells, ZOO_UNIFORM_NAMES } from '../../render/lit/zoo.ts';
import type { Vec2 } from '../../sim/geometry.ts';

const INSECT_LIFE: readonly number[] = INSECTS.map((species) => {
  const own = LIVES.findIndex((life) => life.group === 'insect' && life.key === species.key);
  if (own >= 0) return own;
  return LIVES.findIndex((life) => life.key === (species.key === 'anthill' ? 'ant' : 'termite'));
});

const DEFINES: readonly (readonly [string, string])[] = [
  ['INSECT_SPECIES', `${INSECT_COUNT}`],
  ['INSECT_SLOTS', `${INSECT_SLOTS.length}`],
  ['INSECT_CELL', `${INSECT_CELL_TILES}`],
  ['INSECT_SHELTER', asFloatLiteral(WIND_SHELTER)],
  ['INSECT_BASE', `${GROUP_BASE.insect}`],
  ['INSECT_LIFE_TABLE', INSECT_LIFE.join(', ')],
];

const INSECT_VERTEX_SHADER = assembleShader(insectsVertex, DEFINES);
const INSECT_FRAGMENT_SHADER = assembleShader(insectsFragment, DEFINES);

const INSECT_UNIFORM_NAMES = ['uView', 'uBuffer', 'uTime', 'uVisible', 'uCells', 'uLayer', 'uYear', 'uSpecies', 'uSlotStart', 'uClick', 'uHabitat', 'uGround', 'uFauna', 'uFaunaRect', ...ZOO_UNIFORM_NAMES, ...WEATHER_UNIFORM_NAMES] as const;

export const INSECTS_FROM_ZOOM = nearestSeenZoom(INSECTS.map((species) => species.length));


function speciesTable(): Float32Array {
  const table = new Float32Array(INSECT_COUNT * 28);
  INSECTS.forEach((s, id) => {
    table.set(
      [
        ...s.likes,
        ...s.temperature,
        ...s.season,
        s.day, s.night, s.dusk, s.wind,
        s.length, s.motion, s.rain, 0,
        ...s.colour, s.airborne ? 1 : 0,
        ...s.murk, 0, 0,
      ],
      id * 28,
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

  zoo: ZooState | null = null;
  private readonly probeProgram: WebGLProgram;
  private readonly probeLocations: UniformLocations<(typeof INSECT_UNIFORM_NAMES)[number]>;
  private readonly feedback: ZooProbe;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly cornersVertexArray: WebGLVertexArrayObject,
    private readonly weather: WeatherDataTextures,
    private readonly fauna: FaunaTexture,
  ) {
    this.program = linkProgram(gl, INSECT_VERTEX_SHADER, INSECT_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, INSECT_UNIFORM_NAMES);
    this.probeProgram = linkProgram(gl, INSECT_VERTEX_SHADER, INSECT_FRAGMENT_SHADER, ['gl_Position']);
    this.probeLocations = findUniforms(gl, this.probeProgram, INSECT_UNIFORM_NAMES);
    this.feedback = new ZooProbe(gl);
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
    this.render(world, view, lighting, layer, false);
  }

  probe(world: World, view: LitView, lighting: Lighting): Vec2 | null {
    return this.zoo ? this.render(world, view, lighting, SORTED_WITH_PROPS, true) : null;
  }

  private render(world: World, view: LitView, lighting: Lighting, layer: number, probing: boolean): Vec2 | null {
    if (!this.fauna.texture) return null;
    if (view.zoom < INSECTS_FROM_ZOOM || !this.habitat.texture) return null;
    const visible = 1;

    const { gl } = this;
    const locations = probing ? this.probeLocations : this.locations;
    const reachX = view.width / 2 / view.zoom + INSECT_CELL_TILES;
    const reachY = view.height / 2 / view.zoom + INSECT_CELL_TILES;
    const firstColumn = Math.floor((view.centre.x - reachX) / INSECT_CELL_TILES);
    const firstRow = Math.floor((view.centre.y - reachY) / INSECT_CELL_TILES);
    const columns = Math.floor((view.centre.x + reachX) / INSECT_CELL_TILES) - firstColumn + 1;
    const rows = Math.floor((view.centre.y + reachY) / INSECT_CELL_TILES) - firstRow + 1;
    const cells = this.zoo ? zooCells(this.zoo, INSECT_CELL_TILES) : [firstColumn, firstRow, columns, rows];

    gl.useProgram(probing ? this.probeProgram : this.program);
    gl.bindVertexArray(this.cornersVertexArray);
    if (!probing) useAlphaBlendingForLayer(gl, layer === SORTED_WITH_PROPS);
    setViewUniforms(gl, locations, view);
    gl.uniform1f(locations.uTime, view.time);
    gl.uniform1f(locations.uVisible, visible);
    gl.uniform1f(locations.uLayer, layer);
    gl.uniform4f(locations.uCells, cells[0]!, cells[1]!, cells[2]!, cells[3]!);
    bindZoo(gl, locations, this.zoo, INSECT_CELL_TILES);
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
    const count = cells[2]! * cells[3]! * INSECT_SLOTS.length * 2;
    const draw = (): void => gl.drawArraysInstanced(probing ? gl.POINTS : gl.TRIANGLE_STRIP, 0, 4, count);
    if (probing) return this.feedback.read(count, draw, view);
    draw();
    gl.depthMask(true);
    return null;
  }
}
