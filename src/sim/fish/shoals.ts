export const SHOAL_CAPACITY = 12288;

export type ShoalColumn = Float32Array | Uint16Array | Uint8Array;

export interface ShoalFrame {
  n: number;
  columns: Record<string, ShoalColumn>;
}

export class Shoals {
  n = 0;
  readonly posX = new Float32Array(SHOAL_CAPACITY);
  readonly posY = new Float32Array(SHOAL_CAPACITY);
  readonly heading = new Float32Array(SHOAL_CAPACITY);
  readonly species = new Uint8Array(SHOAL_CAPACITY);
  readonly size = new Uint16Array(SHOAL_CAPACITY);
  readonly depth = new Uint8Array(SHOAL_CAPACITY);

  columns(): Record<string, ShoalColumn> {
    return { posX: this.posX, posY: this.posY, heading: this.heading, species: this.species, size: this.size, depth: this.depth };
  }

  pack(): ShoalFrame {
    const columns: Record<string, ShoalColumn> = {};
    for (const [name, array] of Object.entries(this.columns())) columns[name] = array.slice(0, this.n);
    return { n: this.n, columns };
  }

  unpack(frame: ShoalFrame): void {
    const own = this.columns();
    for (const [name, values] of Object.entries(frame.columns)) own[name]?.set(values);
    for (let at = frame.n; at < this.n; at += 1) this.species[at] = 0;
    this.n = frame.n;
  }
}
