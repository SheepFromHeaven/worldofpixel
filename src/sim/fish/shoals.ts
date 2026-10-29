import { FISH } from './species.ts';
import { MIGRATED } from '../../animals/catalogue.ts';

export const SHOAL_CAPACITY = 12288;

const SHOWN: readonly boolean[] = [false, ...FISH.map((species) => MIGRATED.has(species.key))];

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

  pack(count = this.n): ShoalFrame {
    const columns: Record<string, ShoalColumn> = {};
    for (const [name, array] of Object.entries(this.columns())) columns[name] = array.slice(0, count);
    return { n: count, columns };
  }

  packShown(): ShoalFrame {
    const keep: number[] = [];
    for (let at = 0; at < this.n; at += 1) if (SHOWN[this.species[at]!]) keep.push(at);
    const columns: Record<string, ShoalColumn> = {};
    for (const [name, array] of Object.entries(this.columns())) {
      const packed = new (array.constructor as new (length: number) => ShoalColumn)(keep.length);
      keep.forEach((from, to) => {
        packed[to] = array[from]!;
      });
      columns[name] = packed;
    }
    return { n: keep.length, columns };
  }

  unpack(frame: ShoalFrame): void {
    const own = this.columns();
    for (const [name, values] of Object.entries(frame.columns)) own[name]?.set(values);
    for (let at = frame.n; at < this.n; at += 1) this.species[at] = 0;
    this.n = frame.n;
  }
}
