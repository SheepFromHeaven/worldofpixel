import type { World } from '../../sim/world.ts';
import { habitatAt } from '../insectHabitat.ts';
import type { HabitatSample } from '../insectHabitat.ts';
import { setTextureFiltering } from './glHelpers.ts';

const BAND_ROWS = 16;
const REBUILD_AFTER_MILLISECONDS = 20000;

export class InsectHabitatTexture {
  texture: WebGLTexture | null = null;
  private seed = -1;
  private revision = -1;
  private builtBands = new Set<number>();
  private completedAt = 0;
  private readonly sample: HabitatSample = [0, 0, 0, 0];

  constructor(private readonly gl: WebGL2RenderingContext) {}

  private restart(world: World): void {
    const { gl } = this;
    const { grid } = world;
    this.texture ??= gl.createTexture();
    if (this.seed !== world.seed) {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, grid.columns, grid.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      setTextureFiltering(gl, this.texture!, gl.LINEAR);
    }
    this.seed = world.seed;
    this.revision = world.revision;
    this.builtBands = new Set();
  }

  step(world: World, focusRow: number): void {
    const { gl } = this;
    const { grid } = world;
    const bands = Math.ceil(grid.rows / BAND_ROWS);
    if (this.seed !== world.seed) this.restart(world);
    else if (this.builtBands.size >= bands && this.revision !== world.revision && performance.now() - this.completedAt > REBUILD_AFTER_MILLISECONDS) this.restart(world);
    if (this.builtBands.size >= bands) return;

    const focus = Math.min(bands - 1, Math.max(0, Math.floor(focusRow / BAND_ROWS)));
    let band = -1;
    for (let reach = 0; reach < bands && band < 0; reach += 1) {
      for (const candidate of [focus - reach, focus + reach]) {
        if (candidate >= 0 && candidate < bands && !this.builtBands.has(candidate)) {
          band = candidate;
          break;
        }
      }
    }
    if (band < 0) return;

    const firstRow = band * BAND_ROWS;
    const rows = Math.min(BAND_ROWS, grid.rows - firstRow);
    const pixels = new Uint8Array(grid.columns * rows * 4);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < grid.columns; column += 1) {
        habitatAt(world, column, firstRow + row, this.sample);
        const at = (row * grid.columns + column) * 4;
        pixels[at] = Math.round(this.sample[0] * 255);
        pixels[at + 1] = Math.round(this.sample[1] * 255);
        pixels[at + 2] = Math.round(Math.min(1, this.sample[2]) * 255);
        pixels[at + 3] = Math.round(this.sample[3] * 255);
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, firstRow, grid.columns, rows, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    this.builtBands.add(band);
    if (this.builtBands.size >= bands) this.completedAt = performance.now();
  }
}
