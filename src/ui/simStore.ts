import { useSyncExternalStore } from 'react';
import type { Channel, NodeStatus, PortChannel } from '../engine/types.js';

export interface PortVisual {
  portId: string;
  label: string;
  channel: PortChannel;
  resource: string | null;
  fill: number;
  capacity: number;
  blocked: boolean;
  itemsPerSecond: number;
}

export interface NodeVisual {
  id: string;
  enabled: boolean;
  status: NodeStatus;
  heatTier: number;
  recipeLabel: string | null;
  warning: string | null;
  bufferUsed: number;
  bufferCapacity: number;
  inputs: PortVisual[];
  outputs: PortVisual[];
}

export interface ConnectionVisual {
  id: string;
  channel: Channel | null;
  itemsPerSecond: number;
}

export interface ClockVisual {
  tick: number;
  running: boolean;
  ticksPerSecond: number;
}

type Listener = () => void;

const EMPTY_NODE: NodeVisual = {
  id: '',
  enabled: true,
  status: 'idle',
  heatTier: 0,
  recipeLabel: null,
  warning: null,
  bufferUsed: 0,
  bufferCapacity: 0,
  inputs: [],
  outputs: [],
};

const EMPTY_CONNECTION: ConnectionVisual = { id: '', channel: null, itemsPerSecond: 0 };

export class SimStore {
  private nodes = new Map<string, NodeVisual>();
  private connections = new Map<string, ConnectionVisual>();
  private clock: ClockVisual = { tick: 0, running: false, ticksPerSecond: 0 };
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getNode = (id: string): NodeVisual => this.nodes.get(id) ?? EMPTY_NODE;
  getConnection = (id: string): ConnectionVisual => this.connections.get(id) ?? EMPTY_CONNECTION;
  getClock = (): ClockVisual => this.clock;

  publish(nodes: NodeVisual[], connections: ConnectionVisual[], clock: ClockVisual): void {
    for (const node of nodes) this.nodes.set(node.id, reuseIfEqual(this.nodes.get(node.id), node));
    for (const connection of connections) {
      this.connections.set(
        connection.id,
        reuseIfEqual(this.connections.get(connection.id), connection),
      );
    }
    this.clock = reuseIfEqual(this.clock, clock);
    for (const listener of this.listeners) listener();
  }

  forget(id: string): void {
    this.nodes.delete(id);
    this.connections.delete(id);
  }
}

function reuseIfEqual<T>(previous: T | undefined, next: T): T {
  return previous && JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
}

export const simStore = new SimStore();

export function useNodeVisual(id: string): NodeVisual {
  return useSyncExternalStore(simStore.subscribe, () => simStore.getNode(id));
}

export function useConnectionVisual(id: string): ConnectionVisual {
  return useSyncExternalStore(simStore.subscribe, () => simStore.getConnection(id));
}

export function useClock(): ClockVisual {
  return useSyncExternalStore(simStore.subscribe, simStore.getClock);
}
