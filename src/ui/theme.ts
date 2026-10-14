import { BUNDLE, Channel } from '../engine/types.ts';
import type { PortChannel } from '../engine/types.ts';

/** Coloured-pencil versions of the six channels: same hues, chalkier on paper. */
export const CHANNEL_COLORS: Record<PortChannel, string> = {
  [Channel.Solid]: '#B4762B',
  [Channel.Fluid]: '#2B88A4',
  [Channel.Gas]: '#7A5EA8',
  [Channel.Electricity]: '#C2992A',
  [Channel.Heat]: '#C14434',
  [Channel.Signal]: '#3F8F5E',
  [BUNDLE]: '#7D7466',
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
  disabled: '#A79E8E',
  idle: '#857B6C',
  starved: '#857B6C',
  crafting: '#3F8F5E',
  blocked: '#C2992A',
  overpressure: '#C14434',
} as const;

export const TICKS_PER_SECOND = 10;
