import { amountOf } from '../engine/buffers.js';
import { HEAT_RESOURCE, SimulationEngine } from '../engine/engine.js';
import { createNode, createSourceNode, firstPortOfChannel } from '../engine/nodes.js';
import { CORE_RECIPES, Resources } from '../engine/recipes.js';
import { header, renderTick, verdict } from './render.js';
import type { CombineNode, Recipe } from '../engine/types.js';
import { Channel } from '../engine/types.js';

export interface LevelResult {
  id: string;
  title: string;
  passed: boolean;
  detail: string;
}

type Logger = (line: string) => void;

function newEngine(recipes: readonly Recipe[] = CORE_RECIPES): SimulationEngine {
  const engine = new SimulationEngine();
  for (const recipe of recipes) engine.registerRecipe(recipe);
  return engine;
}

function outputAmount(node: CombineNode, channel: Channel, resource: string): number {
  const port = firstPortOfChannel(node.outputs, channel);
  return port ? amountOf(port.buffer.contents, resource) : 0;
}

function play(engine: SimulationEngine, ticks: number, log: Logger, hooks: Record<number, (engine: SimulationEngine) => void> = {}): void {
  for (let i = 0; i < ticks; i += 1) {
    hooks[engine.tickCount + 1]?.(engine);
    log(renderTick(engine, engine.tick()));
  }
}

export function runLevel1(log: Logger): LevelResult {
  log(header('LEVEL 1 — Mud: Earth (Solid) + Water (Fluid)'));
  const engine = newEngine();

  engine.addNode(createSourceNode('earth', { channel: Channel.Solid, resource: Resources.Earth, rate: 1 }, { label: 'Earth Source' }));
  engine.addNode(createSourceNode('water', { channel: Channel.Fluid, resource: Resources.Water, rate: 1 }, { label: 'Water Source' }));
  const mixer = engine.addNode(
    createNode('mixer', {
      label: 'Mixer',
      inputs: [{ channel: Channel.Solid }, { channel: Channel.Fluid }],
      outputs: [{ channel: Channel.Solid, capacity: 16 }],
      bufferCapacity: 12,
    }),
  );

  engine.connect('earth', 'mixer', Channel.Solid, { throughput: 2 });
  engine.connect('water', 'mixer', Channel.Fluid, { throughput: 2 });

  play(engine, 6, log);

  const mud = outputAmount(mixer, Channel.Solid, Resources.Mud);
  return {
    id: 'level-1',
    title: 'Mud',
    passed: mud > 0,
    detail: `mixer Solid output holds ${mud} × ${Resources.Mud}`,
  };
}

export function runLevel2(log: Logger): LevelResult {
  log(header('LEVEL 2 — Clay Block: Mud + 1 Heat source (thermal tier 1)'));
  const engine = newEngine();

  engine.addNode(createSourceNode('earth', { channel: Channel.Solid, resource: Resources.Earth, rate: 1 }, { label: 'Earth Source' }));
  engine.addNode(createSourceNode('water', { channel: Channel.Fluid, resource: Resources.Water, rate: 1 }, { label: 'Water Source' }));
  engine.addNode(createSourceNode('fire', { channel: Channel.Heat, resource: HEAT_RESOURCE, rate: 1 }, { label: 'Fire Source' }));

  engine.addNode(
    createNode('mixer', {
      label: 'Mixer',
      inputs: [{ channel: Channel.Solid }, { channel: Channel.Fluid }],
      outputs: [{ channel: Channel.Solid, capacity: 16 }],
      bufferCapacity: 12,
    }),
  );
  const kiln = engine.addNode(
    createNode('kiln', {
      label: 'Kiln',
      inputs: [{ channel: Channel.Solid }, { channel: Channel.Heat }],
      outputs: [{ channel: Channel.Solid, capacity: 16 }],
      bufferCapacity: 12,
    }),
  );

  engine.connect('earth', 'mixer', Channel.Solid, { throughput: 2 });
  engine.connect('water', 'mixer', Channel.Fluid, { throughput: 2 });
  engine.connect('mixer', 'kiln', Channel.Solid, { throughput: 2 });
  engine.connect('fire', 'kiln', Channel.Heat, { throughput: 1 });

  play(engine, 8, log);

  const clay = outputAmount(kiln, Channel.Solid, Resources.ClayBlock);
  return {
    id: 'level-2',
    title: 'Clay Block',
    passed: clay > 0 && kiln.heatTier === 1,
    detail: `kiln at heat tier ${kiln.heatTier}, Solid output holds ${clay} × ${Resources.ClayBlock}`,
  };
}

export function runLevel3(log: Logger): LevelResult {
  log(header('LEVEL 3 — Steam & pressure: Water + 2 Heat sources, Gas output blocked'));
  const engine = newEngine();

  engine.addNode(createSourceNode('water', { channel: Channel.Fluid, resource: Resources.Water, rate: 1 }, { label: 'Water Source' }));
  engine.addNode(createSourceNode('fire-a', { channel: Channel.Heat, resource: HEAT_RESOURCE, rate: 1 }, { label: 'Fire Source A' }));
  engine.addNode(createSourceNode('fire-b', { channel: Channel.Heat, resource: HEAT_RESOURCE, rate: 1 }, { label: 'Fire Source B' }));

  const boiler = engine.addNode(
    createNode('boiler', {
      label: 'Boiler',
      inputs: [{ channel: Channel.Fluid }, { channel: Channel.Heat }],
      outputs: [{ channel: Channel.Gas, capacity: 12, blocked: true }],
      bufferCapacity: 6,
    }),
  );

  engine.connect('water', 'boiler', Channel.Fluid, { throughput: 2 });
  engine.connect('fire-a', 'boiler', Channel.Heat, { throughput: 1 });
  engine.connect('fire-b', 'boiler', Channel.Heat, { throughput: 1 });

  let overpressureTick = 0;
  const log3: Logger = (line) => log(line);

  for (let i = 0; i < 10; i += 1) {
    if (engine.tickCount === 8) {
      log3('    >> valve opened on boiler Gas output');
      engine.setPortBlocked('boiler', Channel.Gas, false);
    }
    const report = engine.tick();
    if (!overpressureTick && report.warnings.some((w) => w.message.startsWith('overpressure'))) {
      overpressureTick = report.tick;
    }
    log3(renderTick(engine, report));
  }

  const steam = outputAmount(boiler, Channel.Gas, Resources.Steam);
  return {
    id: 'level-3',
    title: 'Steam / Overpressure',
    passed: overpressureTick > 0 && steam > 0 && boiler.heatTier === 2,
    detail: `boiler at heat tier ${boiler.heatTier}, overpressure stall at tick ${overpressureTick || 'n/a'}, ${steam} × ${Resources.Steam} vented after valve opened`,
  };
}

export function runAllLevels(log: Logger): LevelResult[] {
  const results = [runLevel1(log), runLevel2(log), runLevel3(log)];
  log(header('VERIFICATION SUMMARY'));
  for (const result of results) {
    log(verdict(`${result.id} ${result.title}`, result.passed, result.detail));
  }
  return results;
}
