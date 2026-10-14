import { ClassicPreset, NodeEditor } from 'rete';
import { amountOf } from '../engine/buffers.js';
import { firstPortOfChannel, portId } from '../engine/nodes.js';
import { Resources } from '../engine/recipes.js';
import { Channel } from '../engine/types.js';
import { EngineBridge } from '../ui/EngineBridge.js';
import { SOURCE_CATALOG } from '../ui/nodeCatalog.js';
import type { CanvasArea, Schemes } from '../ui/schemes.js';
import { SimStore } from '../ui/simStore.js';
import { buildStartingGraph } from '../ui/startingGraph.js';
import { BUNDLE } from '../engine/types.js';
import { worldStore } from '../ui/worldStore.js';
import { evaluateWorld } from '../ui/worldStages.js';
import { header, verdict } from './render.js';

const stubArea = {
  translate: async () => true,
  update: async () => undefined,
} as unknown as CanvasArea;

const checks: { label: string; passed: boolean; detail: string }[] = [];

function check(label: string, passed: boolean, detail: string): void {
  checks.push({ label, passed, detail });
}

const outKey = (nodeId: string, channel: Channel) => portId(nodeId, 'output', { channel });
const inKey = (nodeId: string, channel: Channel) => portId(nodeId, 'input', { channel });

/** Wires the Level 1 + Level 2 chain the way a player would: two combine nodes and four pipes. */
async function buildClayChain(editor: NodeEditor<Schemes>, bridge: EngineBridge): Promise<void> {
  await bridge.createNode({
    id: 'mixer',
    label: 'Combine Node #01',
    inputs: [{ channel: Channel.Solid }, { channel: Channel.Fluid }],
    bufferCapacity: 12,
    position: { x: -180, y: -140 },
  });
  await bridge.createNode({
    id: 'kiln',
    label: 'Combine Node #02',
    inputs: [{ channel: Channel.Solid }, { channel: Channel.Heat }],
    bufferCapacity: 12,
    position: { x: 260, y: 20 },
  });

  await wire(editor, 'earth', outKey('earth', Channel.Solid), 'mixer', inKey('mixer', Channel.Solid));
  await wire(editor, 'water', outKey('water', Channel.Fluid), 'mixer', inKey('mixer', Channel.Fluid));
  await wire(editor, 'fire', outKey('fire', Channel.Heat), 'kiln', inKey('kiln', Channel.Heat));
  await wire(editor, 'mixer', outKey('mixer', Channel.Solid), 'kiln', inKey('kiln', Channel.Solid));
}

async function wire(
  editor: NodeEditor<Schemes>,
  source: string,
  sourceOutput: string,
  target: string,
  targetInput: string,
): Promise<boolean> {
  const created = await editor.addConnection(
    new ClassicPreset.Connection(
      editor.getNode(source)!,
      sourceOutput,
      editor.getNode(target)!,
      targetInput,
    ),
  );
  await bridgeRef?.settled();
  return created;
}

/** Set once in main so `wire` can wait for the output sync the connection triggers. */
let bridgeRef: EngineBridge | null = null;

async function main(): Promise<void> {
  console.log(header('BRIDGE CHECK — Rete graph ⇄ headless engine'));

  const editor = new NodeEditor<Schemes>();
  const store = new SimStore();
  const bridge = new EngineBridge(editor, stubArea, store);
  bridge.attach();
  bridgeRef = bridge;
  await buildStartingGraph(editor, bridge);

  check(
    'the canvas opens on the four elements alone',
    bridge.engine.nodes.size === 4 &&
      bridge.engine.connections.length === 0 &&
      [...bridge.engine.nodes.values()].every((node) => node.source),
    `${bridge.engine.nodes.size} source nodes, no pipes`,
  );

  const airOut = firstPortOfChannel(bridge.engine.getNode('air').outputs, Channel.Gas);
  check(
    'the Air source emits on the Gas channel',
    Boolean(airOut) && bridge.engine.getNode('air').source?.resource === Resources.Air,
    `air node exposes ${airOut?.channel ?? 'no'} output`,
  );

  for (const entry of SOURCE_CATALOG) {
    const node = bridge.engine.getNode(entry.key);
    const before = node.outputs.size + node.inputs.size;
    await bridge.addPort(entry.key, 'input', Channel.Signal);
    const outPortId = [...node.outputs.values()][0]!.id;
    await bridge.removePort(entry.key, 'output', outPortId);
    check(
      `${entry.key} source has fixed ports`,
      node.outputs.size + node.inputs.size === before,
      `${before} port${before === 1 ? '' : 's'}, add and remove both refused`,
    );
  }

  await bridge.createNode({
    id: 'probe',
    label: 'Probe',
    inputs: [{ channel: Channel.Solid }, { channel: Channel.Fluid }],
    bufferCapacity: 12,
    position: { x: 0, y: 600 },
  });
  check(
    'an unwired combine node has no outputs',
    bridge.engine.getNode('probe').outputs.size === 0,
    'nothing to make yet, so nothing to emit',
  );

  await wire(editor, 'earth', outKey('earth', Channel.Solid), 'probe', inKey('probe', Channel.Solid));
  check(
    'one ingredient is still no recipe',
    bridge.engine.getNode('probe').outputs.size === 0,
    'Earth alone matches nothing',
  );

  await wire(editor, 'water', outKey('water', Channel.Fluid), 'probe', inKey('probe', Channel.Fluid));
  const probeOut = [...bridge.engine.getNode('probe').outputs.values()][0];
  check(
    'wiring Earth + Water grows a Mud output by itself',
    bridge.engine.getNode('probe').outputs.size === 1 &&
      probeOut?.channel === Channel.Solid &&
      store.getNode('probe').outputs[0]?.resource === Resources.Mud,
    `output appeared on ${probeOut?.channel} reading "${store.getNode('probe').outputs[0]?.resource}"`,
  );

  const probePipe = bridge.engine.connections.find((pipe) => pipe.to.nodeId === 'probe');
  await bridge.removeConnection(probePipe!.id);
  await bridge.settled();
  check(
    'unplugging an ingredient takes the output away again',
    bridge.engine.getNode('probe').outputs.size === 0,
    'recipe no longer satisfied, output port removed',
  );
  await bridge.removeNode('probe');

  await buildClayChain(editor, bridge);
  check(
    'a player-built chain mirrors into the engine',
    bridge.engine.nodes.size === 6 && bridge.engine.connections.length === 4,
    `${bridge.engine.nodes.size} nodes, ${bridge.engine.connections.length} pipes`,
  );

  const mismatched = await editor.addConnection(
    new ClassicPreset.Connection(
      editor.getNode('earth')!,
      outKey('earth', Channel.Solid),
      editor.getNode('mixer')!,
      inKey('mixer', Channel.Fluid),
    ),
  );
  check(
    'incompatible channels are rejected',
    !mismatched && bridge.engine.connections.length === 4,
    `Solid → Fluid refused, still ${bridge.engine.connections.length} pipes`,
  );

  for (let i = 0; i < 8; i += 1) bridge.step();
  const kilnOut = firstPortOfChannel(bridge.engine.getNode('kiln').outputs, Channel.Solid);
  const clayCount = () => (kilnOut ? amountOf(kilnOut.buffer.contents, Resources.ClayBlock) : 0);
  check(
    'levels 1 & 2 run through the canvas topology',
    clayCount() > 0,
    `kiln produced ${clayCount()} × ${Resources.ClayBlock} in 8 ticks`,
  );

  const mixerOutVisual = store.getNode('mixer').outputs[0];
  const kilnOutVisual = store.getNode('kiln').outputs[0];
  const waterOutVisual = store.getNode('water').outputs[0];
  check(
    'ports report the element they carry',
    mixerOutVisual?.resource === Resources.Mud &&
      kilnOutVisual?.resource === Resources.ClayBlock &&
      waterOutVisual?.resource === Resources.Water,
    `water "${waterOutVisual?.resource}", mixer "${mixerOutVisual?.resource}", kiln "${kilnOutVisual?.resource}"`,
  );

  const mixer = editor.getNode('mixer')!;
  await bridge.addPort('mixer', 'input', Channel.Gas);
  const addedInput = [...bridge.engine.getNode('mixer').inputs.values()].filter(
    (port) => port.channel === Channel.Gas,
  );
  check(
    'input ports can be appended at runtime',
    addedInput.length === 1 && Object.keys(mixer.inputs).length === 3,
    `mixer now has ${Object.keys(mixer.inputs).length} inputs`,
  );

  await bridge.removePort('mixer', 'input', addedInput[0]!.id);
  check(
    'input ports can be removed at runtime',
    Object.keys(mixer.inputs).length === 2 &&
      !bridge.engine.getNode('mixer').inputs.has(addedInput[0]!.id),
    `mixer back to ${Object.keys(mixer.inputs).length} inputs`,
  );

  await bridge.toggleNode('water');
  for (let i = 0; i < 6; i += 1) bridge.step();
  const stalledAt = clayCount();
  for (let i = 0; i < 6; i += 1) bridge.step();
  check(
    'switching a node off stalls everything downstream',
    bridge.engine.getNode('water').status === 'disabled' && clayCount() === stalledAt,
    `water offline, clay frozen at ${stalledAt} across 6 further ticks`,
  );

  await bridge.toggleNode('water');
  for (let i = 0; i < 6; i += 1) bridge.step();
  check(
    'switching it back on resumes the chain',
    bridge.engine.getNode('water').enabled && clayCount() > stalledAt,
    `clay ${stalledAt} → ${clayCount()} after power-on`,
  );

  const spawned: string[] = [];
  for (const entry of SOURCE_CATALOG) {
    const id = bridge.nextNodeId(entry.key);
    await bridge.createNode({
      id,
      label: entry.label,
      source: { channel: entry.channel, resource: entry.resource, rate: 1 },
      position: { x: 0, y: 0 },
    });
    spawned.push(id);
  }
  check(
    'every catalog entry spawns a working source',
    spawned.every((id) => bridge.engine.nodes.get(id)?.source && editor.getNode(id)),
    `added ${spawned.join(', ')}`,
  );

  for (const id of spawned) await bridge.removeNode(id);
  check(
    'spawned nodes can be removed again',
    spawned.every((id) => !bridge.engine.nodes.has(id) && !editor.getNode(id)),
    `engine back to ${bridge.engine.nodes.size} nodes`,
  );

  await bridge.createNode({
    id: 'world',
    label: 'World',
    sink: true,
    position: { x: 640, y: 20 },
  });
  const worldNode = bridge.engine.getNode('world');
  const worldPort = [...worldNode.inputs.values()][0];
  check(
    'a World node takes one bundle input and emits nothing',
    worldNode.sink &&
      worldNode.outputs.size === 0 &&
      worldPort?.channel === BUNDLE,
    `world has a ${worldPort?.channel} input, ${worldNode.outputs.size} outputs`,
  );

  await wire(editor, 'kiln', outKey('kiln', Channel.Solid), 'world', worldPort!.id);
  const beforeDelivery = worldStore.get().received;
  for (let i = 0; i < 6; i += 1) bridge.step();
  const worldSnapshot = worldStore.get();
  check(
    'piped goods leave the factory and land in the world',
    (worldNode.delivered.get(Resources.ClayBlock) ?? 0) > 0 &&
      worldSnapshot.received > beforeDelivery &&
      (worldSnapshot.totals.get(Resources.ClayBlock) ?? 0) > 0,
    `${worldNode.delivered.get(Resources.ClayBlock)} × Clay Block delivered, world tally ${worldSnapshot.totals.get(Resources.ClayBlock)}`,
  );

  const dusty = evaluateWorld(new Map([[Resources.Earth, 4]]));
  const rocky = evaluateWorld(new Map([[Resources.Earth, 12]]));
  check(
    'the world needs dirt before it is a planet',
    !dusty.hasPlanet && rocky.hasPlanet && rocky.progress[0]!.unlocked,
    `4 Earth stays dust, 12 Earth makes a rock of radius ${Math.round(rocky.planetRadius)}`,
  );

  const sealess = evaluateWorld(new Map([[Resources.Water, 40]]));
  const seaside = evaluateWorld(
    new Map([
      [Resources.Earth, 20],
      [Resources.Water, 30],
    ]),
  );
  check(
    'later stages wait for the rock to exist',
    !sealess.progress[1]!.unlocked &&
      sealess.counts.seas === 0 &&
      seaside.progress[1]!.unlocked &&
      seaside.counts.seas === 3,
    `water without a planet draws nothing; with one it fills ${seaside.counts.seas} seas`,
  );

  const grown = evaluateWorld(
    new Map([
      [Resources.Earth, 40],
      [Resources.Water, 20],
      [Resources.Air, 10],
      [Resources.Fire, 16],
      [Resources.Mud, 8],
      [Resources.Steam, 12],
      [Resources.ClayBlock, 30],
    ]),
  );
  check(
    'every stage can be reached',
    grown.progress.every((entry) => entry.unlocked) && grown.next === null,
    `all ${grown.progress.length} stages unlocked: ${grown.counts.volcanoes} volcanoes, ${grown.counts.settlements} settlements`,
  );

  check(
    'the World node refuses hand-edited ports',
    bridge.portsAreLocked('world'),
    'bundle input is fixed',
  );

  const [firstPipe] = bridge.engine.connections;
  const pipesBefore = bridge.engine.connections.length;
  await bridge.removeConnection(firstPipe!.id);
  check(
    'a pipe can be removed from the canvas',
    bridge.engine.connections.length === pipesBefore - 1 && !editor.getConnection(firstPipe!.id),
    `${pipesBefore} → ${bridge.engine.connections.length} pipes, gone from both graphs`,
  );

  await bridge.removeNode('fire');
  check(
    'removing a node drops its pipes and any output that depended on it',
    !bridge.engine.nodes.has('fire') &&
      bridge.engine.connections.length === 2 &&
      bridge.engine.getNode('kiln').outputs.size === 0,
    `engine holds ${bridge.engine.nodes.size} nodes, ${bridge.engine.connections.length} pipes; kiln lost its output with the heat`,
  );

  const kilnBefore = bridge.engine.getNode('kiln').heatTier;
  bridge.step();
  check(
    'heat tier falls when the fire source is unplugged',
    bridge.engine.getNode('kiln').heatTier === 0,
    `tier ${kilnBefore} → ${bridge.engine.getNode('kiln').heatTier}`,
  );

  bridge.destroy();

  for (const entry of checks) console.log(verdict(entry.label, entry.passed, entry.detail));
  const failed = checks.filter((entry) => !entry.passed).length;
  console.log(`\n${checks.length - failed}/${checks.length} bridge checks passed`);
  process.exitCode = failed === 0 ? 0 : 1;
}

void main();
