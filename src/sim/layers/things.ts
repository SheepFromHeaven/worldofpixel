import type { TileIndex } from '../grid.ts';
import { Homes } from '../homes/homes.ts';
import { GroundItems } from '../people/groundItems.ts';
import type { Column, Layer } from './layer.ts';

export class ItemsLayer implements Layer {
  readonly id = 'items';
  readonly items = new GroundItems();

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

export class HomesLayer implements Layer {
  readonly id = 'homes';
  readonly homes = new Homes();
  private sent = -1;

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
