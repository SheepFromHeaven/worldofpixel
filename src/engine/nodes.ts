import { createBuffer } from './buffers.ts';
import type { CombineNode, NodeId, Port, PortChannel, PortDirection, SourceSpec } from './types.ts';
import { BUNDLE, NodeStatus } from './types.ts';

export interface PortSpec {
  channel: PortChannel;
  name?: string;
  capacity?: number;
  blocked?: boolean;
}

export interface NodeSpec {
  label?: string;
  sink?: boolean;
  inputs?: PortSpec[];
  outputs?: PortSpec[];
  bufferCapacity?: number;
  source?: SourceSpec;
}

const DEFAULT_PORT_CAPACITY = 16;
const DEFAULT_BUFFER_CAPACITY = 32;

export function portId(nodeId: NodeId, direction: PortDirection, spec: PortSpec): string {
  return `${nodeId}.${direction === 'input' ? 'in' : 'out'}.${spec.name ?? spec.channel}`;
}

export function createPort(nodeId: NodeId, direction: PortDirection, spec: PortSpec): Port {
  return {
    id: portId(nodeId, direction, spec),
    channel: spec.channel,
    nodeId,
    direction,
    buffer: createBuffer(spec.capacity ?? DEFAULT_PORT_CAPACITY),
    blocked: spec.blocked ?? false,
  };
}

export function createNode(id: NodeId, spec: NodeSpec = {}): CombineNode {
  const node: CombineNode = {
    id,
    label: spec.label ?? id,
    inputs: new Map(),
    outputs: new Map(),
    internalBuffer: new Map(),
    bufferCapacity: spec.bufferCapacity ?? DEFAULT_BUFFER_CAPACITY,
    enabled: true,
    sink: spec.sink ?? false,
    delivered: new Map(),
    heatTier: 0,
    status: NodeStatus.Idle,
    lastRecipeId: null,
    warnings: [],
  };

  if (spec.source) node.source = spec.source;

  for (const input of spec.inputs ?? []) {
    const port = createPort(id, 'input', input);
    node.inputs.set(port.id, port);
  }
  for (const output of spec.outputs ?? []) {
    const port = createPort(id, 'output', output);
    node.outputs.set(port.id, port);
  }

  return node;
}

export function createSourceNode(
  id: NodeId,
  source: SourceSpec,
  spec: Omit<NodeSpec, 'source' | 'outputs'> = {},
): CombineNode {
  return createNode(id, {
    ...spec,
    source,
    outputs: [{ channel: source.channel, capacity: Math.max(source.rate * 4, 8) }],
  });
}

export function createSinkNode(id: NodeId, label: string): CombineNode {
  return createNode(id, {
    label,
    sink: true,
    inputs: [{ channel: BUNDLE, capacity: 64 }],
  });
}

export function firstPortOfChannel(
  ports: Map<string, Port>,
  channel: PortChannel,
): Port | undefined {
  for (const port of ports.values()) {
    if (port.channel === channel) return port;
  }
  return undefined;
}

export function portsOfChannel(ports: Map<string, Port>, channel: PortChannel): Port[] {
  return [...ports.values()].filter((port) => port.channel === channel);
}
