import type { Vec2 } from '../../sim/geometry.ts';
import type { LitView } from './litLayer.ts';

export const ZOO_LEGS = 12;

export type ZooGroup = 'insect' | 'amphibian' | 'reptile' | 'bird' | 'mammal' | 'human';

export interface ZooLeg {
  from: Vec2;
  to: Vec2;
  start: number;
  end: number;
}

export interface ZooState {
  group: ZooGroup;
  species: number;
  home: Vec2;
  cell: Vec2;
  travelled?: number;
  legs: readonly ZooLeg[];
  flat?: boolean;
}

export interface ZooAnchor {
  pos: Vec2;
  dir: Vec2;
  going: boolean;
}

export const ZOO_UNIFORM_NAMES = ['uZoo', 'uZooHome', 'uZooLeg', 'uZooWhen', 'uZooFlat'] as const;

export function zooAnchor(zoo: ZooState, time: number): ZooAnchor {
  let pos = zoo.home;
  let dir = { x: 1, y: 0 };
  let going = false;
  for (const leg of zoo.legs) {
    if (leg.end <= leg.start || time < leg.start) break;
    const u = Math.min(1, (time - leg.start) / (leg.end - leg.start));
    const dx = leg.to.x - leg.from.x;
    const dy = leg.to.y - leg.from.y;
    const length = Math.hypot(dx, dy);
    pos = { x: leg.from.x + dx * u, y: leg.from.y + dy * u };
    if (length > 0.001) dir = { x: dx / length, y: dy / length };
    going = u < 1;
  }
  return { pos, dir, going };
}

const legs = new Float32Array(ZOO_LEGS * 4);
const whens = new Float32Array(ZOO_LEGS * 2);

export function bindZoo(
  gl: WebGL2RenderingContext,
  locations: Record<(typeof ZOO_UNIFORM_NAMES)[number], WebGLUniformLocation | null>,
  zoo: ZooState | null,
  cellTiles: number,
): void {
  if (!zoo) {
    gl.uniform4f(locations.uZoo, -1, 0, 0, 0);
    return;
  }
  gl.uniform4f(locations.uZoo, zoo.species, Math.floor(zoo.cell.x / cellTiles), Math.floor(zoo.cell.y / cellTiles), zoo.travelled ?? 0);
  gl.uniform2f(locations.uZooHome, zoo.home.x, zoo.home.y);
  gl.uniform1f(locations.uZooFlat, zoo.flat ? 1 : 0);
  legs.fill(0);
  whens.fill(0);
  zoo.legs.slice(0, ZOO_LEGS).forEach((leg, index) => {
    legs.set([leg.from.x, leg.from.y, leg.to.x, leg.to.y], index * 4);
    whens.set([leg.start, leg.end], index * 2);
  });
  gl.uniform4fv(locations.uZooLeg, legs);
  gl.uniform2fv(locations.uZooWhen, whens);
}

export function zooCells(zoo: ZooState, cellTiles: number): [number, number, number, number] {
  return [Math.floor(zoo.cell.x / cellTiles), Math.floor(zoo.cell.y / cellTiles), 1, 1];
}

const VERTICES_PER_INSTANCE = 4;

const FLOATS_PER_VERTEX = 4;

const CULLED = 2;

export class ZooProbe {
  private readonly buffer: WebGLBuffer;
  private readonly feedback: WebGLTransformFeedback;
  private bytes = 0;
  private out = new Float32Array(0);

  constructor(private readonly gl: WebGL2RenderingContext) {
    const buffer = gl.createBuffer();
    const feedback = gl.createTransformFeedback();
    if (!buffer || !feedback) throw new Error('could not create a feedback buffer');
    this.buffer = buffer;
    this.feedback = feedback;
  }

  read(instances: number, draw: () => void, view: LitView): Vec2 | null {
    const { gl } = this;
    const bytes = instances * VERTICES_PER_INSTANCE * FLOATS_PER_VERTEX * 4;
    gl.bindBuffer(gl.COPY_READ_BUFFER, this.buffer);
    if (bytes > this.bytes) {
      gl.bufferData(gl.COPY_READ_BUFFER, bytes, gl.DYNAMIC_READ);
      this.bytes = bytes;
      this.out = new Float32Array(bytes / 4);
    }
    gl.bindBuffer(gl.COPY_READ_BUFFER, null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.feedback);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.buffer);
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);
    draw();
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

    gl.bindBuffer(gl.COPY_READ_BUFFER, this.buffer);
    gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, this.out, 0, bytes / 4);
    const stride = VERTICES_PER_INSTANCE * FLOATS_PER_VERTEX;
    for (let instance = 0; instance < instances; instance += 1) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let vertex = 0; vertex < VERTICES_PER_INSTANCE; vertex += 1) {
        const at = instance * stride + vertex * FLOATS_PER_VERTEX;
        const x = this.out[at]!;
        const y = this.out[at + 1]!;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      if (minX === CULLED && maxX === CULLED && minY === CULLED && maxY === CULLED) continue;
      const x = (minX + maxX) / 2;
      const y = (minY + maxY) / 2;
      return {
        x: view.centre.x + ((x + 1) / 2 - 0.5) * (view.width / view.zoom),
        y: view.centre.y + ((1 - y) / 2 - 0.5) * (view.height / view.zoom),
      };
    }
    return null;
  }
}
