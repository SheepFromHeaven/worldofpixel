import { ClassicPreset, type NodeEditor } from 'rete';
import { totalOf } from '../engine/buffers.js';
import { portEntries, SimulationEngine } from '../engine/engine.js';
import {
  createNode,
  createSinkNode,
  createSourceNode,
  firstPortOfChannel,
} from '../engine/nodes.js';
import type { PortSpec } from '../engine/nodes.js';
import { CORE_RECIPES } from '../engine/recipes.js';
import type {
  Channel,
  CombineNode,
  Port,
  PortChannel,
  PortDirection,
  ResourceId,
  SourceSpec,
  TickReport,
} from '../engine/types.js';
import type { ConnectionVisual, NodeVisual, PortVisual, SimStore } from './simStore.js';
import { ChannelSocket, CombineNodeRete, nodeHeight } from './schemes.js';
import type { AreaExtra, CanvasArea, Schemes } from './schemes.js';
import { TICKS_PER_SECOND } from './theme.js';
import { worldStore } from './worldStore.js';

export interface CreateNodeOptions {
  id: string;
  label: string;
  inputs?: PortSpec[];
  outputs?: PortSpec[];
  bufferCapacity?: number;
  source?: SourceSpec;
  sink?: boolean;
  position?: { x: number; y: number };
}

const PIPE_THROUGHPUT = 4;
const FLOW_SMOOTHING = 0.4;

export class EngineBridge {
  readonly engine = new SimulationEngine();

  private timer: ReturnType<typeof setInterval> | null = null;
  private flow = new Map<string, number>();
  private lastChannel = new Map<string, Channel>();
  private lastResource = new Map<string, string>();
  private pipeResource = new Map<string, string>();
  private nodeCounter = 0;
  private syncQueue: Promise<void> = Promise.resolve();
  private predicted = new Map<string, string>();

  constructor(
    private readonly editor: NodeEditor<Schemes>,
    private readonly area: CanvasArea,
    private readonly store: SimStore,
  ) {
    for (const recipe of CORE_RECIPES) this.engine.registerRecipe(recipe);
  }

  attach(): void {
    this.editor.addPipe((context) => {
      if (context.type === 'connectioncreate' && !this.isCompatible(context.data)) return;
      if (context.type === 'connectioncreated') {
        this.onConnectionCreated(context.data);
        void this.syncOutputs();
      }
      if (context.type === 'connectionremoved') {
        this.engine.disconnect(context.data.id);
        this.flow.delete(context.data.id);
        this.lastChannel.delete(context.data.id);
        this.pipeResource.delete(context.data.id);
        void this.syncOutputs();
      }
      if (context.type === 'noderemoved') {
        this.engine.removeNode(context.data.id);
        this.store.forget(context.data.id);
        this.predicted.delete(context.data.id);
        void this.syncOutputs();
      }
      return context;
    });
  }

  nextNodeId(prefix = 'combine'): string {
    this.nodeCounter += 1;
    return `${prefix}-${String(this.nodeCounter).padStart(2, '0')}`;
  }

  async createNode(options: CreateNodeOptions): Promise<CombineNodeRete> {
    const engineNode = options.sink
      ? createSinkNode(options.id, options.label)
      : options.source
      ? createSourceNode(options.id, options.source, { label: options.label })
      : createNode(options.id, {
          label: options.label,
          inputs: options.inputs ?? [],
          outputs: options.outputs ?? [],
          ...(options.bufferCapacity === undefined
            ? {}
            : { bufferCapacity: options.bufferCapacity }),
        });

    this.engine.addNode(engineNode);

    const kind = options.sink ? 'sink' : options.source ? 'source' : 'combine';
    const reteNode = new CombineNodeRete(options.id, options.label, kind);
    for (const port of engineNode.inputs.values()) addReteInput(reteNode, port);
    for (const port of engineNode.outputs.values()) addReteOutput(reteNode, port);
    reteNode.height = nodeHeight(reteNode);

    await this.editor.addNode(reteNode);
    if (options.position) {
      await this.area.translate(reteNode.id, options.position);
    }
    await this.syncOutputs();
    return reteNode;
  }

  portsAreLocked(nodeId: string): boolean {
    const node = this.engine.nodes.get(nodeId);
    return Boolean(node?.source || node?.sink);
  }

  async addPort(nodeId: string, direction: PortDirection, channel: PortChannel): Promise<void> {
    const reteNode = this.editor.getNode(nodeId);
    if (!reteNode || this.portsAreLocked(nodeId)) return;
    const port = this.engine.addPort(nodeId, direction, { channel, name: `${channel}-${counter()}` });
    if (direction === 'input') addReteInput(reteNode, port);
    else addReteOutput(reteNode, port);
    await this.refreshNode(reteNode);
    await this.syncOutputs();
  }

  async removePort(nodeId: string, direction: PortDirection, portId: string): Promise<void> {
    const reteNode = this.editor.getNode(nodeId);
    if (!reteNode || this.portsAreLocked(nodeId)) return;

    for (const connection of this.editor.getConnections()) {
      const touches =
        (connection.source === nodeId && connection.sourceOutput === portId) ||
        (connection.target === nodeId && connection.targetInput === portId);
      if (touches) await this.editor.removeConnection(connection.id);
    }

    this.engine.removePort(nodeId, portId);
    if (direction === 'input') reteNode.removeInput(portId);
    else reteNode.removeOutput(portId);
    await this.refreshNode(reteNode);
  }

  async removeConnection(connectionId: string): Promise<void> {
    await this.editor.removeConnection(connectionId);
    this.publish(null);
  }

  async toggleNode(nodeId: string): Promise<void> {
    if (!this.engine.nodes.has(nodeId)) return;
    this.engine.toggleNode(nodeId);
    const reteNode = this.editor.getNode(nodeId);
    if (reteNode) await this.area.update('node', reteNode.id);
    this.publish(null);
  }

  async removeNode(nodeId: string): Promise<void> {
    for (const connection of this.editor.getConnections()) {
      if (connection.source === nodeId || connection.target === nodeId) {
        await this.editor.removeConnection(connection.id);
      }
    }
    await this.editor.removeNode(nodeId);
  }

  step(): void {
    this.publish(this.engine.tick());
    if (this.predictionChanged()) void this.syncOutputs();
  }

  /**
   * Output ports are not placed by hand: a combine node carries exactly the outputs of
   * whichever recipe its suppliers and heat pipes add up to, and loses them when the
   * wiring no longer matches anything.
   *
   * Syncs queue instead of overlapping. Removing a port removes its cables, which fires
   * more editor signals, which ask for another sync — a re-entrancy guard would drop
   * those and leave the graph a step behind the wiring.
   */
  syncOutputs(): Promise<void> {
    this.syncQueue = this.syncQueue.then(() => this.runSync());
    return this.syncQueue;
  }

  /** Resolves once every queued output sync has finished. */
  settled(): Promise<void> {
    return this.syncQueue;
  }

  private async runSync(): Promise<void> {
    for (const nodeId of [...this.engine.nodes.keys()]) await this.syncNodeOutputs(nodeId);
    this.rememberPredictions();
    this.publish(null);
  }

  private async syncNodeOutputs(nodeId: string): Promise<void> {
    const node = this.engine.nodes.get(nodeId);
    const reteNode = this.editor.getNode(nodeId);
    if (!node || !reteNode || node.source || node.sink) return;

    const wanted = new Map<PortChannel, ResourceId>();
    for (const item of this.engine.predictProducts(nodeId)) wanted.set(item.channel, item.resource);

    for (const port of [...node.outputs.values()]) {
      if (wanted.has(port.channel)) continue;
      for (const connection of this.editor.getConnections()) {
        if (connection.source === nodeId && connection.sourceOutput === port.id) {
          await this.editor.removeConnection(connection.id);
        }
      }
      this.engine.removePort(nodeId, port.id);
      reteNode.removeOutput(port.id);
      this.lastResource.delete(port.id);
    }

    for (const [channel, resource] of wanted) {
      const existing = firstPortOfChannel(node.outputs, channel);
      const port = existing ?? this.engine.addPort(nodeId, 'output', { channel });
      if (!existing) addReteOutput(reteNode, port);
      this.lastResource.set(port.id, resource);
    }

    reteNode.height = nodeHeight(reteNode);
    await this.area.update('node', reteNode.id);
  }

  private predictionChanged(): boolean {
    for (const node of this.engine.nodes.values()) {
      if (node.source || node.sink) continue;
      if ((this.engine.predictRecipe(node.id)?.id ?? '') !== (this.predicted.get(node.id) ?? '')) {
        return true;
      }
    }
    return false;
  }

  private rememberPredictions(): void {
    this.predicted.clear();
    for (const node of this.engine.nodes.values()) {
      if (node.source || node.sink) continue;
      this.predicted.set(node.id, this.engine.predictRecipe(node.id)?.id ?? '');
    }
  }

  play(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.step(), 1000 / TICKS_PER_SECOND);
    this.publish(null);
  }

  pause(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.publish(null);
  }

  toggle(): void {
    if (this.timer) this.pause();
    else this.play();
  }

  destroy(): void {
    this.pause();
  }

  publish(report: TickReport | null): void {
    if (report) {
      this.absorbFlow(report);
      worldStore.receive(report.deliveries);
    }

    const nodes: NodeVisual[] = [];
    for (const node of this.engine.nodes.values()) nodes.push(this.describeNode(node));

    const connections: ConnectionVisual[] = this.engine.connections.map((connection) => ({
      id: connection.id,
      channel: this.lastChannel.get(connection.id) ?? null,
      resource:
        this.pipeResource.get(connection.id) ??
        this.lastResource.get(connection.from.portId) ??
        null,
      itemsPerSecond: round((this.flow.get(connection.id) ?? 0) * TICKS_PER_SECOND),
    }));

    this.store.publish(nodes, connections, {
      tick: this.engine.tickCount,
      running: this.timer !== null,
      ticksPerSecond: TICKS_PER_SECOND,
    });
  }

  private absorbFlow(report: TickReport): void {
    const perConnection = new Map<string, number>();
    for (const transfer of report.transfers) {
      perConnection.set(
        transfer.connectionId,
        (perConnection.get(transfer.connectionId) ?? 0) + transfer.amount,
      );
      this.lastChannel.set(transfer.connectionId, transfer.channel);
      this.pipeResource.set(transfer.connectionId, transfer.resource);
    }
    for (const connection of this.engine.connections) {
      const moved = perConnection.get(connection.id) ?? 0;
      const previous = this.flow.get(connection.id) ?? 0;
      this.flow.set(connection.id, previous * (1 - FLOW_SMOOTHING) + moved * FLOW_SMOOTHING);
    }
  }

  private describeNode(node: CombineNode): NodeVisual {
    const recipe = node.lastRecipeId
      ? this.engine.recipes.find((candidate) => candidate.id === node.lastRecipeId)
      : this.engine.predictRecipe(node.id);
    return {
      id: node.id,
      enabled: node.enabled,
      delivered: totalOf(node.delivered),
      status: node.status,
      heatTier: node.heatTier,
      recipeLabel: recipe?.label ?? null,
      warning: node.warnings[0] ?? null,
      bufferUsed: totalOf(node.internalBuffer),
      bufferCapacity: node.bufferCapacity,
      inputs: [...node.inputs.values()].map((port) => this.describePort(node, port)),
      outputs: [...node.outputs.values()].map((port) => this.describePort(node, port)),
    };
  }

  private describePort(node: CombineNode, port: Port): PortVisual {
    const carried = portEntries(port).map((entry) => entry.resource);
    if (carried.length) this.lastResource.set(port.id, carried.join(' + '));
    const sourced = port.direction === 'output' ? node.source?.resource : undefined;
    const resource = carried.join(' + ') || sourced || this.lastResource.get(port.id) || null;

    let itemsPerSecond = 0;
    for (const connection of this.engine.connections) {
      const endpoint = port.direction === 'output' ? connection.from : connection.to;
      if (endpoint.nodeId === node.id && endpoint.portId === port.id) {
        itemsPerSecond += (this.flow.get(connection.id) ?? 0) * TICKS_PER_SECOND;
      }
    }
    return {
      portId: port.id,
      label: port.id.split('.').pop() ?? port.channel,
      channel: port.channel,
      resource,
      fill: totalOf(port.buffer.contents),
      capacity: port.buffer.capacity,
      blocked: port.blocked,
      itemsPerSecond: round(itemsPerSecond),
    };
  }

  private isCompatible(connection: Schemes['Connection']): boolean {
    const source = this.editor.getNode(connection.source);
    const target = this.editor.getNode(connection.target);
    const output = source?.outputs[connection.sourceOutput]?.socket;
    const input = target?.inputs[connection.targetInput]?.socket;
    if (!output || !input) return false;
    return output.isCompatibleWith(input);
  }

  private onConnectionCreated(connection: Schemes['Connection']): void {
    const source = this.engine.nodes.get(connection.source);
    const port = source?.outputs.get(connection.sourceOutput);
    if (!port) return;
    this.engine.connect(connection.source, connection.target, port.channel, {
      id: connection.id,
      fromPortId: connection.sourceOutput,
      toPortId: connection.targetInput,
      throughput: PIPE_THROUGHPUT,
    });
  }

  private async refreshNode(reteNode: CombineNodeRete): Promise<void> {
    reteNode.height = nodeHeight(reteNode);
    await this.area.update('node', reteNode.id);
    this.publish(null);
  }
}

function addReteInput(node: CombineNodeRete, port: Port): void {
  const socket = new ChannelSocket(port.channel, port.id, 'input', port.nodeId);
  node.addInput(port.id, new ClassicPreset.Input(socket, port.channel, true));
}

function addReteOutput(node: CombineNodeRete, port: Port): void {
  const socket = new ChannelSocket(port.channel, port.id, 'output', port.nodeId);
  node.addOutput(port.id, new ClassicPreset.Output(socket, port.channel, true));
}

let portCounter = 0;
function counter(): number {
  portCounter += 1;
  return portCounter;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export type { AreaExtra };
