import type { EngineBridge } from './EngineBridge.js';

let current: EngineBridge | null = null;

export function setBridge(bridge: EngineBridge | null): void {
  current = bridge;
}

export function getBridge(): EngineBridge | null {
  return current;
}
