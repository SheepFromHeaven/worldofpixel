import {
  amountOf,
  clampForChannel,
  depositBounded,
  deposit,
  freeSpace,
  totalOf,
  withdraw,
} from './buffers.js';
import { createPort, firstPortOfChannel } from './nodes.js';
import type { PortSpec } from './nodes.js';
import type {
  ChannelAmounts,
  CombineNode,
  Connection,
  NodeId,
  Port,
  PortChannel,
  PortDirection,
  PortId,
  Recipe,
  ResourceId,
  TickReport,
} from './types.js';
import { BUNDLE, Channel, NodeStatus, parseStackKey, stackKey } from './types.js';

export const HEAT_RESOURCE: ResourceId = 'Fire';

const PRODUCT_PREFIX = 'out';

export function productKey(channel: Channel, resource: ResourceId): string {
  return `${PRODUCT_PREFIX}:${channel}:${resource}`;
}

export function isProductKey(key: string): boolean {
  return key.startsWith(`${PRODUCT_PREFIX}:`);
}

export function parseProductKey(key: string): { channel: Channel; resource: ResourceId } {
  const [, channel, ...rest] = key.split(':');
  return { channel: channel as Channel, resource: rest.join(':') };
}

interface PortEntry {
  key: string;
  channel: Channel;
  resource: ResourceId;
  amount: number;
}

export function portEntries(port: Port): PortEntry[] {
  const entries: PortEntry[] = [];
  for (const [key, amount] of port.buffer.contents) {
    if (port.channel === BUNDLE) {
      const { channel, resource } = parseStackKey(key);
      entries.push({ key, channel, resource, amount });
    } else {
      entries.push({ key, channel: port.channel, resource: key, amount });
    }
  }
  return entries;
}

function portKeyFor(port: Port, channel: Channel, resource: ResourceId): string {
  return port.channel === BUNDLE ? stackKey(channel, resource) : resource;
}

function portAccepts(port: Port, channel: Channel): boolean {
  return port.channel === BUNDLE || port.channel === channel;
}

export function channelsCompatible(a: PortChannel, b: PortChannel): boolean {
  return a === b || a === BUNDLE || b === BUNDLE;
}

export interface PredictedItem {
  channel: Channel;
  resource: ResourceId;
}

export interface ConnectOptions {
  throughput?: number;
  fromPortId?: PortId;
  toPortId?: PortId;
  id?: string;
}

const DEFAULT_THROUGHPUT = 4;
const INTAKE_BATCHES = 4;

const STATUS_RANK: Record<NodeStatus, number> = {
  [NodeStatus.Disabled]: 0,
  [NodeStatus.Idle]: 0,
  [NodeStatus.Starved]: 1,
  [NodeStatus.Crafting]: 2,
  [NodeStatus.Blocked]: 3,
  [NodeStatus.Overpressure]: 4,
};

function raiseStatus(node: CombineNode, status: NodeStatus): void {
  if (STATUS_RANK[status] >= STATUS_RANK[node.status]) node.status = status;
}

export class SimulationEngine {
  readonly nodes = new Map<NodeId, CombineNode>();
  readonly connections: Connection[] = [];
  readonly recipes: Recipe[] = [];

  private currentTick = 0;
  private productReserve = 0;
  private readonly demand = new Map<string, number>();

  get tickCount(): number {
    return this.currentTick;
  }

  addNode<T extends CombineNode>(node: T): T {
    if (this.nodes.has(node.id)) {
      throw new Error(`Duplicate node id: ${node.id}`);
    }
    this.nodes.set(node.id, node);
    return node;
  }

  getNode(id: NodeId): CombineNode {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`Unknown node: ${id}`);
    return node;
  }

  registerRecipe(recipe: Recipe): Recipe {
    this.recipes.push(recipe);
    this.recipes.sort((a, b) => {
      if (a.thermalRequirement !== b.thermalRequirement) {
        return b.thermalRequirement - a.thermalRequirement;
      }
      const weight = ingredientUnits(b.inputsRequired) - ingredientUnits(a.inputsRequired);
      if (weight !== 0) return weight;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    this.productReserve = Math.max(this.productReserve, ingredientUnits(recipe.outputsProduced));
    for (const [channel, resources] of channelEntries(recipe.inputsRequired)) {
      for (const [resource, amount] of Object.entries(resources)) {
        const key = stackKey(channel, resource);
        this.demand.set(key, Math.max(this.demand.get(key) ?? 0, amount));
      }
    }
    return recipe;
  }

  connect(from: NodeId, to: NodeId, channel: PortChannel, options: ConnectOptions = {}): Connection {
    const source = this.getNode(from);
    const target = this.getNode(to);

    const fromPort = options.fromPortId
      ? source.outputs.get(options.fromPortId)
      : firstPortOfChannel(source.outputs, channel);
    const toPort = options.toPortId
      ? target.inputs.get(options.toPortId)
      : firstPortOfChannel(target.inputs, channel);

    if (!fromPort) throw new Error(`${from} has no ${channel} output port`);
    if (!toPort) throw new Error(`${to} has no ${channel} input port`);
    if (!channelsCompatible(fromPort.channel, toPort.channel)) {
      throw new Error(`Channel mismatch: ${fromPort.id} (${fromPort.channel}) -> ${toPort.id} (${toPort.channel})`);
    }

    const connection: Connection = {
      id: options.id ?? `${fromPort.id}->${toPort.id}`,
      channel: fromPort.channel,
      from: { nodeId: from, portId: fromPort.id },
      to: { nodeId: to, portId: toPort.id },
      throughput: options.throughput ?? DEFAULT_THROUGHPUT,
    };
    this.connections.push(connection);
    return connection;
  }

  setNodeEnabled(id: NodeId, enabled: boolean): boolean {
    const node = this.getNode(id);
    node.enabled = enabled;
    if (!enabled) {
      node.status = NodeStatus.Disabled;
      node.heatTier = 0;
      node.lastRecipeId = null;
      node.warnings = [];
    } else {
      node.status = NodeStatus.Idle;
    }
    return node.enabled;
  }

  toggleNode(id: NodeId): boolean {
    return this.setNodeEnabled(id, !this.getNode(id).enabled);
  }

  removeNode(id: NodeId): boolean {
    if (!this.nodes.delete(id)) return false;
    this.dropConnections((connection) => connection.from.nodeId === id || connection.to.nodeId === id);
    return true;
  }

  disconnect(connectionId: string): boolean {
    const before = this.connections.length;
    this.dropConnections((connection) => connection.id === connectionId);
    return this.connections.length < before;
  }

  addPort(nodeId: NodeId, direction: PortDirection, spec: PortSpec): Port {
    const node = this.getNode(nodeId);
    const port = createPort(nodeId, direction, spec);
    const ports = direction === 'input' ? node.inputs : node.outputs;
    if (ports.has(port.id)) throw new Error(`Duplicate port id: ${port.id}`);
    ports.set(port.id, port);
    return port;
  }

  removePort(nodeId: NodeId, portId: PortId): boolean {
    const node = this.getNode(nodeId);
    const removed = node.inputs.delete(portId) || node.outputs.delete(portId);
    if (!removed) return false;
    this.dropConnections(
      (connection) =>
        (connection.from.nodeId === nodeId && connection.from.portId === portId) ||
        (connection.to.nodeId === nodeId && connection.to.portId === portId),
    );
    return true;
  }

  private dropConnections(predicate: (connection: Connection) => boolean): void {
    for (let i = this.connections.length - 1; i >= 0; i -= 1) {
      if (predicate(this.connections[i]!)) this.connections.splice(i, 1);
    }
  }

  setPortBlocked(nodeId: NodeId, channel: PortChannel, blocked: boolean): Port {
    const port = firstPortOfChannel(this.getNode(nodeId).outputs, channel);
    if (!port) throw new Error(`${nodeId} has no ${channel} output port`);
    port.blocked = blocked;
    return port;
  }

  /**
   * What this node would make, judged from the graph rather than from what has
   * already flowed: a source offers its own resource, a combine node offers the
   * products of whichever recipe its upstream suppliers and heat pipes satisfy.
   */
  predictProducts(nodeId: NodeId, seen = new Set<NodeId>()): PredictedItem[] {
    const node = this.nodes.get(nodeId);
    if (!node || seen.has(nodeId)) return [];
    seen.add(nodeId);

    if (node.source) {
      return [{ channel: node.source.channel, resource: node.source.resource }];
    }

    const recipe = this.predictRecipe(nodeId, seen);
    if (!recipe) return [];

    const products: PredictedItem[] = [];
    for (const [channel, resources] of channelEntries(recipe.outputsProduced)) {
      for (const resource of Object.keys(resources)) products.push({ channel, resource });
    }
    return products;
  }

  /** The recipe a node is wired to run, or null when its inputs match nothing. */
  predictRecipe(nodeId: NodeId, seen = new Set<NodeId>()): Recipe | null {
    const node = this.nodes.get(nodeId);
    if (!node || node.source || node.sink) return null;

    const available = new Map<Channel, Set<ResourceId>>();
    const offer = (channel: Channel, resource: ResourceId) => {
      const bucket = available.get(channel) ?? new Set<ResourceId>();
      bucket.add(resource);
      available.set(channel, bucket);
    };

    for (const key of node.internalBuffer.keys()) {
      if (isProductKey(key)) continue;
      const { channel, resource } = parseStackKey(key);
      offer(channel, resource);
    }

    let heatPipes = 0;
    for (const port of node.inputs.values()) {
      for (const entry of portEntries(port)) offer(entry.channel, entry.resource);

      for (const connection of this.connections) {
        if (connection.to.nodeId !== nodeId || connection.to.portId !== port.id) continue;

        const upstream = this.nodes.get(connection.from.nodeId);
        const upstreamPort = upstream?.outputs.get(connection.from.portId);
        if (!upstream || !upstreamPort || !upstream.enabled) continue;

        for (const item of this.predictProducts(upstream.id, new Set(seen))) {
          if (upstreamPort.channel !== BUNDLE && upstreamPort.channel !== item.channel) continue;
          if (!portAccepts(port, item.channel)) continue;
          if (item.channel === Channel.Heat) heatPipes += 1;
          else offer(item.channel, item.resource);
        }
      }
    }

    return (
      this.recipes.find((recipe) => {
        if (recipe.thermalRequirement > heatPipes) return false;
        for (const [channel, resources] of channelEntries(recipe.inputsRequired)) {
          const bucket = available.get(channel);
          for (const resource of Object.keys(resources)) {
            if (!bucket?.has(resource)) return false;
          }
        }
        return true;
      }) ?? null
    );
  }

  tick(): TickReport {
    this.currentTick += 1;
    const report: TickReport = {
      tick: this.currentTick,
      transfers: [],
      reactions: [],
      deliveries: [],
      warnings: [],
    };

    for (const node of this.nodes.values()) {
      node.warnings = [];
      node.heatTier = 0;
      node.lastRecipeId = null;
      node.status = node.enabled ? NodeStatus.Idle : NodeStatus.Disabled;
    }

    this.regenerateSources();
    const heatFeeds = this.transferAcrossConnections(report);

    const choked = new Set<NodeId>();
    for (const node of this.nodes.values()) {
      if (!node.enabled) continue;
      if (node.sink) {
        this.drainIntoWorld(node, report);
        continue;
      }
      node.heatTier = heatFeeds.get(node.id) ?? 0;
      if (this.ingestInputs(node)) choked.add(node.id);
    }

    for (const node of this.nodes.values()) {
      if (!node.enabled || node.sink) continue;
      this.evaluateReaction(node, report, choked.has(node.id));
    }

    for (const node of this.nodes.values()) {
      if (!node.enabled || node.sink) continue;
      this.flushProducts(node, report);
    }

    return report;
  }

  run(ticks: number, onTick?: (report: TickReport) => void): TickReport[] {
    const reports: TickReport[] = [];
    for (let i = 0; i < ticks; i += 1) {
      const report = this.tick();
      reports.push(report);
      onTick?.(report);
    }
    return reports;
  }

  private regenerateSources(): void {
    for (const node of this.nodes.values()) {
      const source = node.source;
      if (!source || !node.enabled) continue;
      const port = firstPortOfChannel(node.outputs, source.channel);
      if (!port || port.blocked) continue;
      const amount = clampForChannel(source.channel, source.rate);
      depositBounded(port.buffer, source.resource, amount);
      raiseStatus(node, NodeStatus.Crafting);
    }
  }

  private transferAcrossConnections(report: TickReport): Map<NodeId, number> {
    const heatFeeds = new Map<NodeId, number>();

    for (const connection of this.connections) {
      const fromNode = this.getNode(connection.from.nodeId);
      const toNode = this.getNode(connection.to.nodeId);
      if (!fromNode.enabled || !toNode.enabled) continue;

      const fromPort = fromNode.outputs.get(connection.from.portId);
      const toPort = toNode.inputs.get(connection.to.portId);
      if (!fromPort || !toPort || fromPort.blocked || toPort.blocked) continue;

      let budget = connection.throughput;
      let heatDelivered = false;

      for (const entry of portEntries(fromPort)) {
        if (budget <= 0) break;
        if (!portAccepts(toPort, entry.channel)) continue;
        const room = freeSpace(toPort.buffer);
        if (room <= 0) break;
        const moved = clampForChannel(entry.channel, Math.min(budget, entry.amount, room));
        if (moved <= 0) continue;

        withdraw(fromPort.buffer.contents, entry.key, moved);
        deposit(toPort.buffer.contents, portKeyFor(toPort, entry.channel, entry.resource), moved);
        budget -= moved;
        if (entry.channel === Channel.Heat) heatDelivered = true;
        report.transfers.push({
          connectionId: connection.id,
          channel: entry.channel,
          resource: entry.resource,
          amount: moved,
        });
      }

      if (heatDelivered) {
        heatFeeds.set(connection.to.nodeId, (heatFeeds.get(connection.to.nodeId) ?? 0) + 1);
      }
    }

    return heatFeeds;
  }

  /** Everything that reaches a sink leaves the factory: tallied, then gone. */
  private drainIntoWorld(node: CombineNode, report: TickReport): void {
    let received = 0;
    for (const port of node.inputs.values()) {
      for (const entry of portEntries(port)) {
        const taken = withdraw(port.buffer.contents, entry.key, entry.amount);
        if (taken <= 0) continue;
        node.delivered.set(entry.resource, (node.delivered.get(entry.resource) ?? 0) + taken);
        report.deliveries.push({
          nodeId: node.id,
          channel: entry.channel,
          resource: entry.resource,
          amount: taken,
        });
        received += taken;
      }
    }
    node.status = received > 0 ? NodeStatus.Crafting : NodeStatus.Idle;
  }

  private ingestInputs(node: CombineNode): boolean {
    let choked = false;
    const backedUp = hasPendingProducts(node);

    for (const port of node.inputs.values()) {
      for (const entry of portEntries(port)) {
        if (entry.channel === Channel.Heat) {
          withdraw(port.buffer.contents, entry.key, entry.amount);
          continue;
        }
        if (backedUp) {
          choked = true;
          continue;
        }
        const key = stackKey(entry.channel, entry.resource);
        const appetite =
          (this.demand.get(key) ?? 0) * INTAKE_BATCHES - amountOf(node.internalBuffer, key);
        const room = this.internalFreeSpace(node) - this.productReserve;
        const accepted = Math.min(entry.amount, room, appetite);
        if (accepted <= 0) {
          choked = true;
          continue;
        }
        withdraw(port.buffer.contents, entry.key, accepted);
        deposit(node.internalBuffer, key, accepted);
      }
    }

    return choked;
  }

  private internalFreeSpace(node: CombineNode): number {
    return Math.max(0, node.bufferCapacity - totalOf(node.internalBuffer));
  }

  private evaluateReaction(node: CombineNode, report: TickReport, choked: boolean): void {
    if (node.source) return;

    const recipe = this.recipes.find(
      (candidate) =>
        node.heatTier >= candidate.thermalRequirement && hasIngredients(node, candidate),
    );

    if (!recipe) {
      if (choked) this.reportIntakeHalt(node, report);
      else raiseStatus(node, NodeStatus.Starved);
      return;
    }

    const consumed = ingredientUnits(recipe.inputsRequired);
    const produced = ingredientUnits(recipe.outputsProduced);
    const spaceAfterConsuming = this.internalFreeSpace(node) + consumed;

    if (produced > spaceAfterConsuming) {
      this.reportOverpressure(node, recipe.label, report);
      return;
    }

    for (const [channel, resources] of channelEntries(recipe.inputsRequired)) {
      for (const [resource, amount] of Object.entries(resources)) {
        withdraw(node.internalBuffer, stackKey(channel, resource), amount);
      }
    }
    for (const [channel, resources] of channelEntries(recipe.outputsProduced)) {
      for (const [resource, amount] of Object.entries(resources)) {
        deposit(node.internalBuffer, productKey(channel, resource), amount);
      }
    }

    raiseStatus(node, NodeStatus.Crafting);
    node.lastRecipeId = recipe.id;
    report.reactions.push({ nodeId: node.id, recipeId: recipe.id, heatTier: node.heatTier });
  }

  private flushProducts(node: CombineNode, report: TickReport): void {
    for (const key of [...node.internalBuffer.keys()].sort()) {
      if (!isProductKey(key)) continue;
      const { channel, resource } = parseProductKey(key);
      const pending = amountOf(node.internalBuffer, key);
      if (pending <= 0) continue;

      const port =
        firstPortOfChannel(node.outputs, channel) ?? firstPortOfChannel(node.outputs, BUNDLE);
      if (!port || port.blocked) {
        this.reportBacklog(node, resource, report);
        continue;
      }
      const accepted = depositBounded(
        port.buffer,
        portKeyFor(port, channel, resource),
        clampForChannel(channel, pending),
      );
      withdraw(node.internalBuffer, key, accepted);
      if (accepted < pending) this.reportBacklog(node, resource, report);
    }
  }

  private reportIntakeHalt(node: CombineNode, report: TickReport): void {
    raiseStatus(node, NodeStatus.Overpressure);
    const message = `overpressure: output backed up, intake halted (${totalOf(node.internalBuffer)}/${node.bufferCapacity})`;
    node.warnings.push(message);
    report.warnings.push({ nodeId: node.id, message });
  }

  private reportOverpressure(node: CombineNode, stalled: string, report: TickReport): void {
    raiseStatus(node, NodeStatus.Overpressure);
    const message = `overpressure: ${stalled} stalled, internal buffer full (${totalOf(node.internalBuffer)}/${node.bufferCapacity})`;
    node.warnings.push(message);
    report.warnings.push({ nodeId: node.id, message });
  }

  private reportBacklog(node: CombineNode, resource: ResourceId, report: TickReport): void {
    if (node.status === NodeStatus.Overpressure) return;
    raiseStatus(node, NodeStatus.Blocked);
    const message = `backpressure: ${resource} held in internal buffer (${totalOf(node.internalBuffer)}/${node.bufferCapacity})`;
    node.warnings.push(message);
    report.warnings.push({ nodeId: node.id, message });
  }
}

function channelEntries(amounts: ChannelAmounts): [Channel, Record<ResourceId, number>][] {
  return Object.entries(amounts).filter(
    (entry): entry is [Channel, Record<ResourceId, number>] => entry[1] !== undefined,
  );
}

export function ingredientUnits(amounts: ChannelAmounts): number {
  let total = 0;
  for (const [, resources] of channelEntries(amounts)) {
    for (const amount of Object.values(resources)) total += amount;
  }
  return total;
}

function hasPendingProducts(node: CombineNode): boolean {
  for (const [key, amount] of node.internalBuffer) {
    if (amount > 0 && isProductKey(key)) return true;
  }
  return false;
}

function hasIngredients(node: CombineNode, recipe: Recipe): boolean {
  for (const [channel, resources] of channelEntries(recipe.inputsRequired)) {
    for (const [resource, amount] of Object.entries(resources)) {
      if (amountOf(node.internalBuffer, stackKey(channel, resource)) < amount) return false;
    }
  }
  return true;
}
