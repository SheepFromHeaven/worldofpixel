import type { Column, Layer } from '../../sim/layers/layer.ts';
import { registerLayer } from '../../sim/layers/registry.ts';
import { Homes } from './homes.ts';

declare module '../../sim/world.ts' {
  interface World {
    readonly homes: Homes;
  }
}

class HomesLayer implements Layer {
  readonly id = 'homes';
  private sent = -1;
  constructor(readonly homes: Homes) {}

  columns(): Record<string, Column> {
    return {};
  }

  pack(): number[] | null {
    if (this.sent === this.homes.revision) return null;
    this.sent = this.homes.revision;
    return this.homes.pack();
  }

  unpack(_tiles: Int32Array, delta: unknown): void {
    if (delta) this.homes.apply(delta as number[]);
  }

  introduce(): void {
    this.sent = -1;
  }

  snapshot(): number[] {
    return this.homes.state();
  }

  restore(saved: unknown): void {
    this.homes.restore(saved as number[]);
  }
}

registerLayer({
  id: 'homes',
  order: 20,
  create: () => {
    const homes = new Homes();
    return { layer: new HomesLayer(homes), exposed: { homes } };
  },
});
