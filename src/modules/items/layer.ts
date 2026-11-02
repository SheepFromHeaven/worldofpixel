import type { TileIndex } from '../../sim/grid.ts';
import type { Column, Layer } from '../../sim/layers/layer.ts';
import { registerLayer } from '../../sim/layers/registry.ts';
import { GroundItems } from './groundItems.ts';

declare module '../../sim/world.ts' {
  interface World {
    readonly items: GroundItems;
  }
}

class ItemsLayer implements Layer {
  readonly id = 'items';
  constructor(readonly items: GroundItems) {}

  columns(): Record<string, Column> {
    return {};
  }

  pack(): number[] {
    return this.items.drain();
  }

  unpack(_tiles: Int32Array, delta: unknown): TileIndex[] {
    return this.items.apply(delta as number[]);
  }

  introduce(): void {
    this.items.invalidate();
  }

  snapshot(): number[][] {
    return this.items.state();
  }

  restore(saved: unknown): void {
    this.items.restore(saved as number[][]);
  }
}

registerLayer({
  id: 'items',
  order: 10,
  create: () => {
    const items = new GroundItems();
    return { layer: new ItemsLayer(items), exposed: { items } };
  },
});
