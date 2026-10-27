import { geologyOf, sliceElevation } from '../../sim/geology/geology.ts';
import type { Geology } from '../../sim/geology/geology.ts';
import type { Sample } from '../../sim/geology/geology.ts';
import type { World } from '../../sim/world.ts';
import { setTextureFiltering } from './glHelpers.ts';
import type { LitView } from './litLayer.ts';

const CHUNK = 64;
const BUDGET_MILLISECONDS = 6;
const MARGIN_CHUNKS = 1;

export class StrataTexture {
  texture: WebGLTexture | null = null;
  field: WebGLTexture | null = null;
  ground: WebGLTexture | null = null;
  geology: Geology | null = null;
  private seed = -1;
  private level = -1;
  private built = new Set<number>();
  private readonly sample: Sample = { rock: 0, mineral: 0, cave: 0, above: 0, life: 0 };

  constructor(private readonly gl: WebGL2RenderingContext) {}

  private restart(world: World, level: number): void {
    const { gl } = this;
    const { grid } = world;
    this.texture ??= gl.createTexture();
    if (this.seed !== world.seed) {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, grid.columns, grid.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      setTextureFiltering(gl, this.texture!, gl.NEAREST);
      this.field ??= gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.field);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, grid.columns, grid.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      setTextureFiltering(gl, this.field!, gl.LINEAR);
      this.ground ??= gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.ground);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, grid.columns, grid.rows, 0, gl.RED, gl.FLOAT, world.field.height);
      setTextureFiltering(gl, this.ground!, gl.LINEAR);
      this.geology = geologyOf(world);
    }
    this.seed = world.seed;
    this.level = level;
    this.built = new Set();
  }

  step(world: World, view: LitView, level: number): void {
    if (this.seed !== world.seed || this.level !== level) this.restart(world, level);
    const { gl, geology } = this;
    if (!geology) return;
    const elevation = sliceElevation(world, level);
    const { grid } = world;
    const chunkColumns = Math.ceil(grid.columns / CHUNK);
    const chunkRows = Math.ceil(grid.rows / CHUNK);

    const halfWidth = view.width / 2 / view.zoom;
    const halfHeight = view.height / 2 / view.zoom;
    const fromColumn = Math.max(0, Math.floor(grid.column(view.centre.x - halfWidth) / CHUNK) - MARGIN_CHUNKS);
    const toColumn = Math.min(chunkColumns - 1, Math.floor(grid.column(view.centre.x + halfWidth) / CHUNK) + MARGIN_CHUNKS);
    const fromRow = Math.max(0, Math.floor(grid.row(view.centre.y - halfHeight) / CHUNK) - MARGIN_CHUNKS);
    const toRow = Math.min(chunkRows - 1, Math.floor(grid.row(view.centre.y + halfHeight) / CHUNK) + MARGIN_CHUNKS);
    const centreColumn = grid.column(view.centre.x) / CHUNK;
    const centreRow = grid.row(view.centre.y) / CHUNK;

    const wanted: number[] = [];
    for (let row = fromRow; row <= toRow; row += 1) {
      for (let column = fromColumn; column <= toColumn; column += 1) {
        const key = row * chunkColumns + column;
        if (!this.built.has(key)) wanted.push(key);
      }
    }
    if (wanted.length === 0) return;
    wanted.sort((a, b) => {
      const da = Math.hypot((a % chunkColumns) + 0.5 - centreColumn, Math.floor(a / chunkColumns) + 0.5 - centreRow);
      const db = Math.hypot((b % chunkColumns) + 0.5 - centreColumn, Math.floor(b / chunkColumns) + 0.5 - centreRow);
      return da - db;
    });

    const started = performance.now();
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    for (const key of wanted) {
      const column0 = (key % chunkColumns) * CHUNK;
      const row0 = Math.floor(key / chunkColumns) * CHUNK;
      const width = Math.min(CHUNK, grid.columns - column0);
      const height = Math.min(CHUNK, grid.rows - row0);
      const pixels = new Uint8Array(width * height * 4);
      const fields = new Uint8Array(width * height * 4);
      for (let row = 0; row < height; row += 1) {
        const y = grid.y(row0 + row);
        for (let column = 0; column < width; column += 1) {
          geology.sample(grid.x(column0 + column), y, elevation, this.sample);
          const at = (row * width + column) * 4;
          pixels[at] = this.sample.rock;
          pixels[at + 1] = this.sample.mineral;
          pixels[at + 2] = this.sample.cave;
          pixels[at + 3] = this.sample.cave >= 4 ? Math.min(254, Math.round(this.sample.above / 2)) : this.sample.cave > 0 ? this.sample.life * 16 + 15 : 255;
          const cave = this.sample.cave;
          fields[at] = cave >= 4 ? 128 : cave > 0 ? 255 : 0;
          fields[at + 1] = cave === 2 ? 255 : 0;
          fields[at + 3] = 255;
        }
      }
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, column0, row0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      gl.bindTexture(gl.TEXTURE_2D, this.field);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, column0, row0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, fields);
      this.built.add(key);
      if (performance.now() - started > BUDGET_MILLISECONDS) break;
    }
  }
}
