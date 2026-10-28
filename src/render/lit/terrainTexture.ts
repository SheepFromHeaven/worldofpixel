import { STEEP_ONE, metresOf } from '../../sim/steep.ts';
import type { WorldField } from '../../sim/terrain/worldfield.ts';
import type { World } from '../../sim/world.ts';
import { setTextureFiltering } from './glHelpers.ts';

export const TERRAIN_BLUR_TILES = 2;
const BAND_ROWS = 128;

function boxBlur(source: Float32Array, target: Float32Array, length: number, stride: number, lines: number, lineStride: number, radius: number): void {
  const width = radius * 2 + 1;
  for (let line = 0; line < lines; line += 1) {
    const base = line * lineStride;
    let sum = 0;
    for (let k = -radius; k <= radius; k += 1) sum += source[base + Math.min(Math.max(k, 0), length - 1) * stride]!;
    for (let at = 0; at < length; at += 1) {
      target[base + at * stride] = sum / width;
      const leaving = Math.min(Math.max(at - radius, 0), length - 1);
      const entering = Math.min(Math.max(at + radius + 1, 0), length - 1);
      sum += source[base + entering * stride]! - source[base + leaving * stride]!;
    }
  }
}

export class TerrainTexture {
  texture: WebGLTexture | null = null;
  private built: WorldField | null = null;

  constructor(private readonly gl: WebGL2RenderingContext) {}

  update(world: World): void {
    if (this.built === world.field) return;
    const { gl } = this;
    const { grid, height } = world.field;
    const { columns, rows } = grid;

    const metres = new Float32Array(grid.count);
    for (let tile = 0; tile < metres.length; tile += 1) metres[tile] = metresOf(height[tile]!);
    const scratch = new Float32Array(grid.count);
    for (let pass = 0; pass < 2; pass += 1) {
      boxBlur(metres, scratch, columns, 1, rows, columns, TERRAIN_BLUR_TILES);
      boxBlur(scratch, metres, rows, columns, columns, 1, TERRAIN_BLUR_TILES);
    }

    this.texture ??= gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, columns, rows, 0, gl.RG, gl.FLOAT, null);
    const band = new Float32Array(columns * BAND_ROWS * 2);
    for (let first = 0; first < rows; first += BAND_ROWS) {
      const count = Math.min(BAND_ROWS, rows - first);
      for (let at = 0; at < columns * count; at += 1) {
        const tile = first * columns + at;
        band[at * 2] = metres[tile]!;
        band[at * 2 + 1] = world.steep[tile]! / STEEP_ONE;
      }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, first, columns, count, gl.RG, gl.FLOAT, band);
    }
    setTextureFiltering(gl, this.texture!, gl.LINEAR);
    this.built = world.field;
  }
}
