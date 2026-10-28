import { PEOPLE_AUBURN, PEOPLE_HAIR, PEOPLE_SKIN } from '../palette.ts';
import { POPULATION } from '../../sim/people/people.ts';
import type { People } from '../../sim/people/people.ts';
import type { UniformLocations } from './glHelpers.ts';
import { findUniforms, linkProgram, setViewUniforms, useAlphaBlendingForLayer } from './glHelpers.ts';
import { drawnAsModel } from './humanPose.ts';
import type { Lighting } from './lighting.ts';
import { MAX_POINTS } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import { packPointLights } from './pointLightData.ts';
import { HUMAN_FRAGMENT_SHADER, HUMAN_VERTEX_SHADER } from './shaders/shaderSources.ts';

const HUMAN_UNIFORM_NAMES = ['uView', 'uBuffer', 'uTime', 'uGloom', 'uTint', 'uPerson', 'uInfo', 'uBase', 'uAccent', 'uLights', 'uPoint', 'uPointColor'] as const;

const SCALES: readonly number[] = [1, 0.94];

const VIEW_MARGIN_TILES = 3;

const BASE: readonly (readonly [number, number, number])[] = [PEOPLE_SKIN, PEOPLE_SKIN];

const ACCENT: readonly (readonly [number, number, number])[] = [PEOPLE_HAIR, PEOPLE_AUBURN];

export interface HumanDraw {
  x: number;
  y: number;
  heading: number;
  stride: number;
  moving: boolean;
  who: number;
}

export class HumanPass {
  private readonly program: WebGLProgram;
  private readonly locations: UniformLocations<(typeof HUMAN_UNIFORM_NAMES)[number]>;
  private readonly person = new Float32Array(POPULATION * 4);
  private readonly info = new Float32Array(POPULATION * 4);
  private readonly base = new Float32Array(BASE.flatMap((colour) => [...colour]));
  private readonly accent = new Float32Array(ACCENT.flatMap((colour) => [...colour]));

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly cornersVertexArray: WebGLVertexArrayObject,
  ) {
    this.program = linkProgram(gl, HUMAN_VERTEX_SHADER, HUMAN_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, HUMAN_UNIFORM_NAMES);
  }

  draw(view: LitView, lighting: Lighting, people: People): void {
    const halfWide = view.width / (2 * view.zoom) + VIEW_MARGIN_TILES;
    const halfTall = view.height / (2 * view.zoom) + VIEW_MARGIN_TILES;
    const drawn: HumanDraw[] = [];
    for (let who = 0; who < people.count; who += 1) {
      if (!drawnAsModel(people, who)) continue;
      const x = people.posX[who]!;
      const y = people.posY[who]!;
      if (Math.abs(x - view.centre.x) > halfWide || Math.abs(y - view.centre.y) > halfTall) continue;
      drawn.push({ x, y, heading: people.heading[who]!, stride: people.stride[who]!, moving: people.moveSpeed[who]! > 0, who });
    }
    this.drawList(view, lighting, drawn);
  }

  drawList(view: LitView, lighting: Lighting, drawn: readonly HumanDraw[]): void {
    const count = Math.min(drawn.length, POPULATION);
    drawn.slice(0, count).forEach((one, slot) => {
      this.person.set([one.x, one.y, one.heading, one.stride], slot * 4);
      this.info.set([one.moving ? 1 : 0, one.who, SCALES[one.who] ?? 1, 0], slot * 4);
    });
    if (count === 0) return;

    const { gl, locations } = this;
    const points = packPointLights(lighting);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.cornersVertexArray);
    useAlphaBlendingForLayer(gl, true);
    setViewUniforms(gl, locations, view);
    gl.uniform1f(locations.uTime, view.time);
    gl.uniform1f(locations.uGloom, lighting.gloom);
    gl.uniform3f(locations.uTint, lighting.tint[0], lighting.tint[1], lighting.tint[2]);
    gl.uniform4fv(locations.uPerson, this.person);
    gl.uniform4fv(locations.uInfo, this.info);
    gl.uniform3fv(locations.uBase, this.base);
    gl.uniform3fv(locations.uAccent, this.accent);
    gl.uniform1i(locations.uLights, Math.min(points.count, MAX_POINTS));
    gl.uniform4fv(locations.uPoint, points.positionsAndReach);
    gl.uniform3fv(locations.uPointColor, points.colours);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.depthMask(true);
  }
}
