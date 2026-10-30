import { useEffect, useRef } from 'react';
import { MIND } from '../render/palette.ts';
import type { MindView } from '../sim/mind/mind.ts';
import { State } from '../sim/mind/mind.ts';
import { isRoot, neuronIndex, neuronOf, parentsOf, recipeMaking } from '../sim/mind/neurons.ts';
import { HIT_RADIUS, QUESTION, SOMA, TREE_HEIGHT, TREE_WIDTH, caption, drawBackdrop, drawCell, drawFibre, iconOf, nameOf, ringAround, rim } from './mindArt.ts';
import type { MindHost, Spot } from './mindArt.ts';

const PAD = 40;

const LAYER_GAP_FAR = 124;

const LAYER_GAP_NEAR = 84;

const ROW_GAP_FAR = 64;

const ROW_GAP_NEAR = 36;

const SWEEPS = 4;

const DIM_EDGE = 0.16;

const DIM_NODE = 0.26;

interface GNode {
  key: string;
  label: string;
  icon: ReturnType<typeof iconOf> | null;
  neuron: number;
  idea: number;
  depth: number;
  slot: number;
  at: Spot;
}

interface GEdge {
  from: string;
  to: string;
  bend: number;
}

interface Graph {
  nodes: Map<string, GNode>;
  edges: GEdge[];
  width: number;
  height: number;
}

function layersOf(nodes: Map<string, GNode>, edges: readonly GEdge[]): GNode[][] {
  const into = new Map<string, string[]>();
  for (const edge of edges) into.set(edge.to, [...(into.get(edge.to) ?? []), edge.from]);
  const depthOf = (key: string, seen = 0): number => {
    const parents = into.get(key) ?? [];
    return parents.length === 0 || seen > 12 ? 0 : 1 + Math.max(...parents.map((parent) => depthOf(parent, seen + 1)));
  };
  const layers: GNode[][] = [];
  for (const node of nodes.values()) {
    node.depth = depthOf(node.key);
    (layers[node.depth] ??= []).push(node);
  }
  for (const layer of layers) layer.sort((a, b) => a.label.localeCompare(b.label) || a.key.localeCompare(b.key));
  return layers.map((layer) => layer ?? []);
}

function untangle(layers: GNode[][], edges: readonly GEdge[]): void {
  const place = (layer: GNode[]): void => layer.forEach((node, at) => (node.slot = (at + 0.5) / layer.length));
  layers.forEach(place);
  const mean = (node: GNode, keys: readonly string[], nodes: ReadonlyMap<string, GNode>): number => {
    const slots = keys.map((key) => nodes.get(key)?.slot).filter((slot): slot is number => slot !== undefined);
    return slots.length === 0 ? node.slot : slots.reduce((sum, slot) => sum + slot, 0) / slots.length;
  };
  const byKey = new Map(layers.flat().map((node) => [node.key, node]));
  const parentsOfKey = (key: string): string[] => edges.filter((edge) => edge.to === key).map((edge) => edge.from);
  const childrenOfKey = (key: string): string[] => edges.filter((edge) => edge.from === key).map((edge) => edge.to);
  for (let sweep = 0; sweep < SWEEPS; sweep += 1) {
    for (let at = 1; at < layers.length; at += 1) {
      const layer = layers[at]!;
      const wanted = new Map(layer.map((node) => [node.key, mean(node, parentsOfKey(node.key), byKey)]));
      layer.sort((a, b) => wanted.get(a.key)! - wanted.get(b.key)! || a.label.localeCompare(b.label));
      place(layer);
    }
    for (let at = layers.length - 2; at >= 0; at -= 1) {
      const layer = layers[at]!;
      const wanted = new Map(layer.map((node) => [node.key, mean(node, childrenOfKey(node.key), byKey)]));
      layer.sort((a, b) => wanted.get(a.key)! - wanted.get(b.key)! || a.label.localeCompare(b.label));
      place(layer);
    }
  }
}

function graphOf(view: MindView): Graph {
  const known = new Set(view.neurons.map((neuron) => neuron.index));
  const nodes = new Map<string, GNode>();
  const edges: GEdge[] = [];
  const add = (key: string, label: string, icon: GNode['icon'], neuron: number, idea: number): void => {
    nodes.set(key, { key, label, icon, neuron, idea, depth: 0, slot: 0, at: { x: 0, y: 0 } });
  };
  const link = (to: string, parents: readonly number[]): void => {
    const seen = new Map<number, number>();
    for (const parent of parents) seen.set(parent, (seen.get(parent) ?? 0) + 1);
    for (const [parent, count] of seen) for (let one = 0; one < count; one += 1) edges.push({ from: `n${parent}`, to, bend: count === 1 ? 5 : one === 0 ? 10 : -10 });
  };
  for (const index of known) add(`n${index}`, neuronOf(index).label, iconOf(neuronOf(index).id), index, -1);
  for (const index of known) {
    const parents = parentsOf(index);
    if (parents.length > 0 && parents.every((parent) => known.has(parent))) link(`n${index}`, parents);
  }
  for (const idea of view.hypotheses) {
    if (idea.order || idea.state !== State.Open || !idea.parents.every((parent) => known.has(parent))) continue;
    add(`b${idea.id}`, 'an idea', null, -1, idea.id);
    link(`b${idea.id}`, idea.parents);
  }
  const layers = layersOf(nodes, edges);
  untangle(layers, edges);

  const widest = Math.max(1, ...layers.map((layer) => layer.length));
  const available = TREE_HEIGHT - PAD * 2;
  const rowGap = Math.max(ROW_GAP_NEAR, Math.min(ROW_GAP_FAR, available / widest));
  const layerGap = layers.length > 1 ? Math.max(LAYER_GAP_NEAR, Math.min(LAYER_GAP_FAR, (TREE_WIDTH - PAD * 2) / (layers.length - 1))) : 0;
  const width = Math.max(TREE_WIDTH, (layers.length - 1) * layerGap + PAD * 2);
  const height = Math.max(TREE_HEIGHT, (widest - 1) * rowGap + PAD * 2);
  const left = (width - (layers.length - 1) * layerGap) / 2;
  layers.forEach((layer, depth) => {
    layer.forEach((node, at) => {
      node.at = { x: Math.round(left + depth * layerGap), y: Math.round(height / 2 + (at - (layer.length - 1) / 2) * rowGap) };
    });
  });
  return { nodes, edges, width, height };
}

function lineageOf(key: string, edges: readonly GEdge[]): { nodes: Set<string>; edges: Set<GEdge> } {
  const reach = new Set<string>([key]);
  const up = [key];
  while (up.length > 0) {
    const at = up.pop()!;
    for (const edge of edges) if (edge.to === at && !reach.has(edge.from)) (reach.add(edge.from), up.push(edge.from));
  }
  const down = [key];
  const below = new Set<string>([key]);
  while (down.length > 0) {
    const at = down.pop()!;
    for (const edge of edges) if (edge.from === at && !below.has(edge.to)) (below.add(edge.to), down.push(edge.to));
  }
  const into = new Set<string>([...reach, ...below]);
  const lit = new Set<GEdge>();
  const nodes = new Set<string>(into);
  for (const edge of edges) {
    if (!into.has(edge.to)) continue;
    lit.add(edge);
    nodes.add(edge.from);
  }
  return { nodes, edges: lit };
}

function describe(graph: Graph, hover: string | null): string {
  if (graph.nodes.size === 0) return 'nothing to review yet. the people have not met anything';
  const node = hover ? graph.nodes.get(hover) : undefined;
  if (!node) return 'everything the group has worked out. hover a neuron to follow its connections';
  if (node.idea >= 0) return `an idea being carried out, made of ${graph.edges.filter((edge) => edge.to === node.key).map((edge) => nameOf(Number(edge.from.slice(1)))).join(' + ')}`;
  const recipe = recipeMaking(node.neuron);
  const connected = graph.edges.some((edge) => edge.to === node.key);
  if (recipe && connected) return `${recipe.title}: ${recipe.parents.map((id) => neuronOf(neuronIndex(id)).label).join(' + ')}. ${recipe.words}`;
  return isRoot(node.neuron) ? `${node.label}, met in the world` : `${node.label}, seen but not worked out yet`;
}

export function ReviewTree({ host, onHover }: { host: MindHost; onHover: (text: string) => void }): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext('2d');
    if (!element || !ctx) return undefined;
    element.width = TREE_WIDTH;
    element.height = TREE_HEIGHT;

    let graph: Graph = { nodes: new Map(), edges: [], width: TREE_WIDTH, height: TREE_HEIGHT };
    let revision = -1;
    let hover: string | null = null;
    let panning: { x: number; y: number; fromX: number; fromY: number } | null = null;
    const pan = { x: 0, y: 0 };
    let shown = '';
    let handle = 0;
    const started = performance.now();

    const clamp = (): void => {
      pan.x = Math.round(Math.max(TREE_WIDTH - graph.width, Math.min(0, pan.x)));
      pan.y = Math.round(Math.max(TREE_HEIGHT - graph.height, Math.min(0, pan.y)));
    };
    const screenOf = (event: PointerEvent | WheelEvent): Spot => {
      const rect = element.getBoundingClientRect();
      return { x: ((event.clientX - rect.left) * TREE_WIDTH) / rect.width, y: ((event.clientY - rect.top) * TREE_HEIGHT) / rect.height };
    };
    const hitOf = (event: PointerEvent): string | null => {
      const at = screenOf(event);
      let found: string | null = null;
      let least = HIT_RADIUS;
      for (const node of graph.nodes.values()) {
        const away = Math.hypot(node.at.x + pan.x - at.x, node.at.y + pan.y - at.y);
        if (away < least) {
          least = away;
          found = node.key;
        }
      }
      return found;
    };

    const onDown = (event: PointerEvent): void => {
      const at = screenOf(event);
      element.setPointerCapture(event.pointerId);
      panning = { x: at.x, y: at.y, fromX: pan.x, fromY: pan.y };
    };
    const onMove = (event: PointerEvent): void => {
      if (panning) {
        const at = screenOf(event);
        pan.x = panning.fromX + at.x - panning.x;
        pan.y = panning.fromY + at.y - panning.y;
        clamp();
        return;
      }
      hover = hitOf(event);
    };
    const onUp = (): void => {
      panning = null;
    };
    const onLeave = (): void => {
      hover = null;
    };
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      pan.y -= event.shiftKey ? 0 : event.deltaY;
      pan.x -= event.shiftKey ? event.deltaY : event.deltaX;
      clamp();
    };
    const onMenu = (event: Event): void => event.preventDefault();

    const frame = (): void => {
      handle = requestAnimationFrame(frame);
      const time = (performance.now() - started) / 1000;
      const view = host.view();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      drawBackdrop(ctx, time);
      if (!view) return;
      if (view.revision !== revision) {
        revision = view.revision;
        graph = graphOf(view);
        clamp();
      }
      ctx.setTransform(1, 0, 0, 1, pan.x, pan.y);
      const lit = hover && graph.nodes.has(hover) ? lineageOf(hover, graph.edges) : null;

      for (const edge of graph.edges) {
        const from = graph.nodes.get(edge.from);
        const to = graph.nodes.get(edge.to);
        if (!from || !to) continue;
        ctx.globalAlpha = lit && !lit.edges.has(edge) ? DIM_EDGE : 1;
        drawFibre(ctx, rim(from.at, to.at, SOMA + 1), rim(to.at, from.at, SOMA + 3), edge.bend, to.idea >= 0 ? 'pulsing' : 'fixed', time, false);
      }
      for (const node of graph.nodes.values()) {
        ctx.globalAlpha = lit && !lit.nodes.has(node.key) ? DIM_NODE : 1;
        drawCell(ctx, node.at, 1, node.icon, time, node.icon ? null : QUESTION);
        if (hover === node.key) ringAround(ctx, node.at, SOMA + 3, MIND.light, 2);
      }
      for (const node of graph.nodes.values()) {
        ctx.globalAlpha = lit && !lit.nodes.has(node.key) ? DIM_NODE : 1;
        caption(ctx, node.label, node.at, MIND.bright);
      }
      ctx.globalAlpha = 1;

      element.style.cursor = panning ? 'grabbing' : hover ? 'pointer' : 'grab';
      const text = describe(graph, hover);
      if (text !== shown) {
        shown = text;
        onHover(text);
      }
    };

    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onUp);
    element.addEventListener('pointerleave', onLeave);
    element.addEventListener('contextmenu', onMenu);
    element.addEventListener('wheel', onWheel, { passive: false });
    frame();
    return () => {
      cancelAnimationFrame(handle);
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onUp);
      element.removeEventListener('pointerleave', onLeave);
      element.removeEventListener('contextmenu', onMenu);
      element.removeEventListener('wheel', onWheel);
    };
  }, [host, onHover]);

  return <canvas ref={canvas} className="se-mind-tree" />;
}
