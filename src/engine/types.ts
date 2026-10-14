export const Channel = {
  Solid: 'Solid',
  Fluid: 'Fluid',
  Gas: 'Gas',
  Electricity: 'Electricity',
  Heat: 'Heat',
  Signal: 'Signal',
} as const;

export type Channel = (typeof Channel)[keyof typeof Channel];

export const ALL_CHANNELS: readonly Channel[] = [
  Channel.Solid,
  Channel.Fluid,
  Channel.Gas,
  Channel.Electricity,
  Channel.Heat,
  Channel.Signal,
];

export const BUNDLE = 'Bundle' as const;

export type PortChannel = Channel | typeof BUNDLE;

export const SIGNAL_MIN = 0;
export const SIGNAL_MAX = 15;

export type ResourceId = string;
export type NodeId = string;
export type PortId = string;
export type PortDirection = 'input' | 'output';

export interface PortBuffer {
  contents: Map<ResourceId, number>;
  capacity: number;
}

export interface Port {
  id: PortId;
  channel: PortChannel;
  nodeId: NodeId;
  direction: PortDirection;
  buffer: PortBuffer;
  blocked: boolean;
}

export interface Connection {
  id: string;
  channel: PortChannel;
  from: { nodeId: NodeId; portId: PortId };
  to: { nodeId: NodeId; portId: PortId };
  throughput: number;
}

export type ChannelAmounts = Partial<Record<Channel, Record<ResourceId, number>>>;

export interface Recipe {
  id: string;
  label: string;
  inputsRequired: ChannelAmounts;
  thermalRequirement: number;
  outputsProduced: ChannelAmounts;
}

export const NodeStatus = {
  Disabled: 'disabled',
  Idle: 'idle',
  Starved: 'starved',
  Crafting: 'crafting',
  Blocked: 'blocked',
  Overpressure: 'overpressure',
} as const;

export type NodeStatus = (typeof NodeStatus)[keyof typeof NodeStatus];

export interface SourceSpec {
  channel: Channel;
  resource: ResourceId;
  rate: number;
}

export interface CombineNode {
  id: NodeId;
  label: string;
  inputs: Map<PortId, Port>;
  outputs: Map<PortId, Port>;
  internalBuffer: Map<string, number>;
  bufferCapacity: number;
  enabled: boolean;
  /** A sink swallows everything piped into it and tallies it instead of reacting. */
  sink: boolean;
  delivered: Map<ResourceId, number>;
  heatTier: number;
  status: NodeStatus;
  lastRecipeId: string | null;
  warnings: string[];
  source?: SourceSpec;
}

export interface TickReport {
  tick: number;
  transfers: { connectionId: string; channel: Channel; resource: ResourceId; amount: number }[];
  reactions: { nodeId: NodeId; recipeId: string; heatTier: number }[];
  deliveries: { nodeId: NodeId; channel: Channel; resource: ResourceId; amount: number }[];
  warnings: { nodeId: NodeId; message: string }[];
}

export function stackKey(channel: Channel, resource: ResourceId): string {
  return `${channel}:${resource}`;
}

export function parseStackKey(key: string): { channel: Channel; resource: ResourceId } {
  const separator = key.indexOf(':');
  return {
    channel: key.slice(0, separator) as Channel,
    resource: key.slice(separator + 1),
  };
}
