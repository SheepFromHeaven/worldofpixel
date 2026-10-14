import { useSyncExternalStore } from 'react';
import type { Channel, ResourceId } from '../engine/types.js';

export interface WorldSnapshot {
  totals: Map<ResourceId, number>;
  entries: [ResourceId, number][];
  received: number;
  latest: { key: string; resource: ResourceId; channel: Channel } | null;
}

const EMPTY: WorldSnapshot = { totals: new Map(), entries: [], received: 0, latest: null };

type Listener = () => void;

class WorldStore {
  private snapshot: WorldSnapshot = EMPTY;
  private totals = new Map<ResourceId, number>();
  private serial = 0;
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get = (): WorldSnapshot => this.snapshot;

  receive(deliveries: { channel: Channel; resource: ResourceId; amount: number }[]): void {
    if (deliveries.length === 0) return;

    let received = this.snapshot.received;
    let latest = this.snapshot.latest;

    for (const delivery of deliveries) {
      this.totals.set(
        delivery.resource,
        (this.totals.get(delivery.resource) ?? 0) + delivery.amount,
      );
      received += delivery.amount;
      this.serial += 1;
      latest = {
        key: `${delivery.resource}-${this.serial}`,
        resource: delivery.resource,
        channel: delivery.channel,
      };
    }

    this.snapshot = {
      totals: new Map(this.totals),
      entries: [...this.totals.entries()].sort(([a], [b]) => (a < b ? -1 : 1)),
      received,
      latest,
    };
    this.emit();
  }

  clear(): void {
    this.totals.clear();
    this.snapshot = EMPTY;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export const worldStore = new WorldStore();

export function useWorld(): WorldSnapshot {
  return useSyncExternalStore(worldStore.subscribe, worldStore.get);
}
