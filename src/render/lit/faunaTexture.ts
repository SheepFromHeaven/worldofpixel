import type { FaunaMirror } from '../../sim/fauna/pack.ts';
import { LIFE_COUNT } from '../../sim/fauna/life.ts';

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
    const bandRows = mirror.rows * LIFE_COUNT;
    if (!this.texture || this.columns !== mirror.columns || this.rows !== mirror.rows) {
      this.texture ??= gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, mirror.columns * 2, bandRows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.columns = mirror.columns;
      this.rows = mirror.rows;
      this.suit = null;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (this.suit !== mirror.suit) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, mirror.columns, 0, mirror.columns, bandRows, gl.RGBA, gl.UNSIGNED_BYTE, mirror.suit);
      this.suit = mirror.suit;
    }
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, mirror.columns, bandRows, gl.RGBA, gl.UNSIGNED_BYTE, mirror.levels);
    this.version = mirror.version;
  }
}
