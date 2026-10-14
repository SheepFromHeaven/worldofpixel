import type { PortBuffer, ResourceId } from './types.ts';
import { Channel, SIGNAL_MAX, SIGNAL_MIN } from './types.ts';

export function createBuffer(capacity: number): PortBuffer {
  return { contents: new Map(), capacity };
}

export function totalOf(contents: Map<ResourceId, number>): number {
  let total = 0;
  for (const amount of contents.values()) total += amount;
  return total;
}

export function freeSpace(buffer: PortBuffer): number {
  return Math.max(0, buffer.capacity - totalOf(buffer.contents));
}

export function amountOf(contents: Map<ResourceId, number>, resource: ResourceId): number {
  return contents.get(resource) ?? 0;
}

export function deposit(
  contents: Map<ResourceId, number>,
  resource: ResourceId,
  amount: number,
): void {
  if (amount <= 0) return;
  contents.set(resource, amountOf(contents, resource) + amount);
}

export function withdraw(
  contents: Map<ResourceId, number>,
  resource: ResourceId,
  amount: number,
): number {
  const available = amountOf(contents, resource);
  const taken = Math.min(available, amount);
  if (taken <= 0) return 0;
  const remainder = available - taken;
  if (remainder === 0) contents.delete(resource);
  else contents.set(resource, remainder);
  return taken;
}

export function clampForChannel(channel: Channel, amount: number): number {
  if (channel !== Channel.Signal) return amount;
  return Math.min(SIGNAL_MAX, Math.max(SIGNAL_MIN, amount));
}

export function depositBounded(buffer: PortBuffer, resource: ResourceId, amount: number): number {
  const accepted = Math.min(amount, freeSpace(buffer));
  deposit(buffer.contents, resource, accepted);
  return accepted;
}

export function sortedEntries(contents: Map<ResourceId, number>): [ResourceId, number][] {
  return [...contents.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
