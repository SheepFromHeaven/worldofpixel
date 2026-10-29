import type { TileIndex } from '../grid.ts';
import { Cover } from '../covers.ts';
import type { Column, LayerHost, Layer } from './layer.ts';
import { packColumns, sparse, unpackColumns } from './layer.ts';

export const WEAR_FULL = 255;

const FADE_BAND = 1 << 16;
const FADE_SWEEP_DAYS = 0.25;
const PATH_WEAR = 64;

export interface TrailsHost extends LayerHost {
  readonly cover: Uint8Array;
  trample(tile: TileIndex): void;
  held(tile: TileIndex): boolean;
}

export class Trails implements Layer {
  readonly id = 'trails';
  private fading = 0;
  private fadeOwed = 0;

  constructor(
    readonly wear: Uint8Array,
    private readonly host: TrailsHost,
  ) {}

  columns(): Record<string, Column> {
    return { wear: this.wear };
  }

  pack(tiles: Int32Array): unknown {
    return packColumns(tiles, this.columns());
  }

  unpack(tiles: Int32Array, delta: unknown): void {
    unpackColumns(tiles, this.columns(), delta as Record<string, Column>);
  }

  introduce(): void {}

  snapshot(): unknown {
    return sparse(this.wear);
  }

  restore(saved: unknown): void {
    const pairs = saved as number[];
    for (let i = 0; i + 1 < pairs.length; i += 2) this.wear[pairs[i]!] = pairs[i + 1]!;
  }

  tread(index: TileIndex, steps = 1): void {
    const { host, wear } = this;
    const worn = wear[index]!;
    const capped = Math.min(WEAR_FULL, worn + steps);
    wear[index] = capped;
    host.mark(index);
    const cover = host.cover[index]!;
    if (capped >= PATH_WEAR && (cover === Cover.Grass || cover === Cover.Scrub)) host.trample(index);
    if (capped >> 4 !== worn >> 4 || host.cover[index] !== cover) host.touch(index);
  }

  fade(days: number): void {
    const { host, wear } = this;
    this.fadeOwed += (days / FADE_SWEEP_DAYS) * wear.length;
    const budget = Math.min(Math.floor(this.fadeOwed), FADE_BAND);
    if (budget <= 0) return;
    this.fadeOwed = Math.min(this.fadeOwed - budget, FADE_BAND);

    const end = Math.min(wear.length, this.fading + budget);
    for (let i = this.fading; i < end; i += 1) {
      const worn = wear[i]!;
      if (worn === 0 || host.held(i)) continue;
      wear[i] = worn - 1;
      host.mark(i);
      if (worn - 1 >> 4 !== worn >> 4) host.touch(i);
    }
    this.fading = end >= wear.length ? 0 : end;
  }
}
