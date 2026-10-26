import type { FaunaMirror } from '../../sim/fauna/pack.ts';
import { FAUNA_ATLAS_ACROSS, FAUNA_ATLAS_DOWN, LIFE_COUNT } from '../../sim/fauna/life.ts';

export class FaunaTexture {
  texture: WebGLTexture | null = null;
  private version = -1;
  private suit: Uint8Array | null = null;
  private columns = 0;
  private rows = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {}

  update(mirror: FaunaMirror | null): void {
    if (!mirror || mirror.version === this.version) return;
    const { gl } = this;
    const { columns, rows } = mirror;
    if (!this.texture || this.columns !== columns || this.rows !== rows) {
      this.texture ??= gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, FAUNA_ATLAS_ACROSS * columns * 2, FAUNA_ATLAS_DOWN * rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.columns = columns;
      this.rows = rows;
      this.suit = null;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    const block = columns * rows * 4;
    const upload = (source: Uint8Array, side: number): void => {
      for (let id = 0; id < LIFE_COUNT; id += 1) {
        const x = ((id % FAUNA_ATLAS_ACROSS) * 2 + side) * columns;
        const y = Math.floor(id / FAUNA_ATLAS_ACROSS) * rows;
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, columns, rows, gl.RGBA, gl.UNSIGNED_BYTE, source.subarray(id * block, (id + 1) * block));
      }
    };
    if (this.suit !== mirror.suit) {
      upload(mirror.suit, 1);
      this.suit = mirror.suit;
    }
    upload(mirror.levels, 0);
    this.version = mirror.version;
  }
}
