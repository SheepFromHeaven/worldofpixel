import { BUNDLE, Channel } from '../engine/types.js';
import type { PortChannel } from '../engine/types.js';

export const CHANNEL_COLORS: Record<PortChannel, string> = {
  [Channel.Solid]: '#D97706',
  [Channel.Fluid]: '#06B6D4',
  [Channel.Gas]: '#8B5CF6',
  [Channel.Electricity]: '#EAB308',
  [Channel.Heat]: '#EF4444',
  [Channel.Signal]: '#10B981',
  [BUNDLE]: '#94A3B8',
};

export const PORT_CHANNELS: readonly PortChannel[] = [
  Channel.Solid,
  Channel.Fluid,
  Channel.Gas,
  Channel.Electricity,
  Channel.Heat,
  Channel.Signal,
  BUNDLE,
];

export const STATUS_COLORS = {
  disabled: '#475569',
  idle: '#64748B',
  starved: '#64748B',
  crafting: '#10B981',
  blocked: '#EAB308',
  overpressure: '#EF4444',
} as const;

export const TICKS_PER_SECOND = 10;
