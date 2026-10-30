import { useEffect, useRef, useState } from 'react';
import { MIND } from '../render/palette.ts';
import { BRAIN_RADIUS } from '../sim/mind/growth.ts';
import type { CellView, HypothesisView, MindView, NeuronView } from '../sim/mind/mind.ts';
import { State, Step } from '../sim/mind/mind.ts';
import { RECIPES, isRoot, neuronIndex, neuronOf, parentsOf } from '../sim/mind/neurons.ts';
import { PERSON_NAMES } from '../sim/people/thoughts.ts';
import {
  HIT_RADIUS,
  SOMA,
  TREE_HEIGHT,
  TREE_WIDTH,
  caption,
  CENTRE_X,
  CENTRE_Y,
  drawBackdrop,
  drawCore,
  drawCell,
  drawCross,
  drawDormant,
  drawFibre,
  drawJoin,
  drawTrail,
  iconOf,
  nameOf,
  ringAround,
  spotOf,
} from './mindArt.ts';
import type { Fate, MindHost, Spot } from './mindArt.ts';
import { PixelBody, PixelHeading, PixelIcon, PixelText } from './pixel/Pixel.tsx';

type Node = { kind: 'neuron'; neuron: NeuronView; at: Spot } | { kind: 'cell'; cell: CellView; at: Spot };

interface Drag {
  from: number;
  startedAt: number;
  pointer: Spot;
  path: Spot[];
  heading: number;
  at: number;
  carry: number;
}

interface Retract {
  path: Spot[];
  heading: number;
  at: number;
}

interface Judged {
  cell: number;
  parent: number;
  path: Spot[];
  heading: number;
  at: number;
  attached: number;
  withered: number;
  fate: 'waiting' | 'withered' | 'taken';
  since: number;
}

interface Wire {
  key: string;
  parents: number[];
  target: Spot;
  targetKey: string;
  fate: Fate;
  alpha: number;
}

interface Focus {
  key: string | null;
  level: number;
  at: number;
}

const MIN_ZOOM = 1;

const MAX_ZOOM = 3.5;

const RETRACT_SECONDS = 0.45;

const WITHER_SECONDS = 1.6;

const JUDGE_PATIENCE_SECONDS = 3;

const GROW_SPEED = 38;

const TURN_PER_PIXEL = 0.06;

const DIM = 0.16;

const CROSSED = 0.1;

const FOCUS_RISE = 6;

const FOCUS_FALL = 4;

const grow = (drag: Drag, start: Spot, time: number): void => {
  const elapsed = Math.min(0.05, Math.max(0, time - drag.at));
  drag.at = time;
  if (drag.path.length === 0) drag.path.push({ x: start.x + Math.cos(drag.heading) * (SOMA + 1), y: start.y + Math.sin(drag.heading) * (SOMA + 1) });
  if (Math.hypot(drag.pointer.x - start.x, drag.pointer.y - start.y) < HIT_RADIUS && drag.path.length < 10) return;
  drag.carry += GROW_SPEED * elapsed;
  const steps = Math.floor(drag.carry);
  drag.carry -= steps;
  for (let step = 0; step < steps; step += 1) {
    const tip = drag.path[drag.path.length - 1]!;
    if (Math.hypot(drag.pointer.x - tip.x, drag.pointer.y - tip.y) < 2) break;
    const want = Math.atan2(drag.pointer.y - tip.y, drag.pointer.x - tip.x);
    let turn = want - drag.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    drag.heading += Math.max(-TURN_PER_PIXEL, Math.min(TURN_PER_PIXEL, turn)) + (Math.sin(drag.path.length * 0.19 + drag.from) * 0.1 + Math.sin(drag.path.length * 0.53) * 0.06);
    drag.path.push({ x: tip.x + Math.cos(drag.heading), y: tip.y + Math.sin(drag.heading) });
  }
};

const arrived = (drag: Drag, target: Node | null): boolean => {
  if (!target || target.kind !== 'cell') return false;
  const tip = drag.path[drag.path.length - 1];
  return !!tip && Math.hypot(tip.x - target.at.x, tip.y - target.at.y) < HIT_RADIUS + 4;
};

function nodesOf(view: MindView): Node[] {
  return [...view.neurons.map((neuron): Node => ({ kind: 'neuron', neuron, at: spotOf(neuron.x, neuron.y) })), ...view.cells.map((cell): Node => ({ kind: 'cell', cell, at: spotOf(cell.x, cell.y) }))];
}

function hitOf(nodes: readonly Node[], point: Spot): Node | null {
  let found: Node | null = null;
  let least = HIT_RADIUS;
  for (const node of nodes) {
    const away = Math.hypot(node.at.x - point.x, node.at.y - point.y);
    if (away < least) {
      least = away;
      found = node;
    }
  }
  return found;
}

const keyOf = (node: Node): string => (node.kind === 'neuron' ? `n${node.neuron.index}` : `x${node.cell.index}`);

const whole = (cell: CellView): boolean => cell.attached.length >= cell.sockets;

const STEP_WORDS = ['', 'something stirs here', 'something is taking shape', 'a new idea is forming'];

function describe(view: MindView, node: Node | null, focused: CellView | null): string {
  const tired = view.curious ? '' : '. nobody has the mind for it now';
  if (!node) {
    if (focused) return `working on a cell: drag a neuron onto it. a wrong one withers and tires the mind. click the background to let go${tired}`;
    return `click a dark cell to work on it. wheel zooms, drag the background pans${tired}`;
  }
  if (node.kind === 'cell') {
    const { cell } = node;
    if (whole(cell)) {
      const job = view.hypotheses.find((hypothesis) => !hypothesis.order && hypothesis.result === cell.index);
      const who = job && job.tryer >= 0 ? `${PERSON_NAMES[job.tryer] ?? 'someone'}: ` : '';
      return `whole, the people will try it. ${who}${job?.note ?? 'waiting'}`;
    }
    return `${STEP_WORDS[cell.step]}. ${cell.attached.length} of ${cell.sockets} fibres${cell.withered.length > 0 ? `, ${cell.withered.length} withered` : ''}${tired}`;
  }
  const crossed = focused?.withered.includes(node.neuron.index) ? ', withered on this cell' : '';
  return `${neuronOf(node.neuron.index).label}, known${crossed}`;
}

function lineageOf(focus: string, wires: readonly Wire[]): Set<string> {
  const lit = new Set<string>([focus]);
  const up = [focus];
  const above = new Set<string>(up);
  while (up.length > 0) {
    const key = up.pop()!;
    for (const wire of wires) {
      if (wire.targetKey !== key || lit.has(wire.key)) continue;
      lit.add(wire.key);
      for (const parent of wire.parents) {
        const next = `n${parent}`;
        lit.add(next);
        if (!above.has(next)) {
          above.add(next);
          up.push(next);
        }
      }
    }
  }
  const down = [focus];
  const below = new Set<string>(down);
  while (down.length > 0) {
    const key = down.pop()!;
    for (const wire of wires) {
      if (!wire.parents.some((parent) => `n${parent}` === key)) continue;
      lit.add(wire.key);
      for (const parent of wire.parents) lit.add(`n${parent}`);
      lit.add(wire.targetKey);
      if (!below.has(wire.targetKey)) {
        below.add(wire.targetKey);
        down.push(wire.targetKey);
      }
    }
  }
  return lit;
}

function cellFocusOf(cell: CellView, view: MindView): Set<string> {
  const lit = new Set<string>([`x${cell.index}`, `c${cell.index}`]);
  for (const neuron of view.neurons) if (!cell.withered.includes(neuron.index)) lit.add(`n${neuron.index}`);
  return lit;
}

const droop = (path: readonly Spot[], progress: number): Spot[] =>
  path
    .map((point, step) => ({ x: point.x, y: point.y + progress * progress * 14 * (step / Math.max(1, path.length)) }))
    .slice(0, Math.max(1, Math.ceil(path.length * (1 - progress * 0.35))));

interface Scene {
  view: MindView | null;
  time: number;
  drag: Drag | null;
  retract: Retract | null;
  judged: Judged[];
  hover: Node | null;
  flashes: Map<number, number>;
  focus: Focus;
  focused: number | null;
}

function drawTree(ctx: CanvasRenderingContext2D, scene: Scene): Node[] {
  const { view, time, drag, retract, hover, flashes, focus, focused } = scene;
  drawBackdrop(ctx, time);
  drawCore(ctx, time);
  if (!view) return [];

  const nodes = nodesOf(view);
  const spots = new Map<number, Spot>();
  for (const node of nodes) spots.set(node.kind === 'neuron' ? node.neuron.index : node.cell.index, node.at);
  const target = focused === null ? null : (view.cells.find((cell) => cell.index === focused) ?? null);

  const recipeWires: Wire[] = [];
  for (const neuron of view.neurons) {
    if (isRoot(neuron.index)) continue;
    const parents = parentsOf(neuron.index).filter((parent) => spots.has(parent) && !view.cells.some((cell) => cell.index === parent));
    if (parents.length > 0) recipeWires.push({ key: `r${neuron.index}`, parents, target: spots.get(neuron.index)!, targetKey: `n${neuron.index}`, fate: 'fixed', alpha: 1 });
  }
  const cellWires: Wire[] = [];
  for (const cell of view.cells) {
    if (cell.attached.length === 0) continue;
    cellWires.push({ key: `c${cell.index}`, parents: [...cell.attached], target: spots.get(cell.index)!, targetKey: `x${cell.index}`, fate: whole(cell) ? 'pulsing' : 'fixed', alpha: 0.85 });
  }

  const lit = focus.level > 0 && focus.key ? (focus.key.startsWith('f') ? (target ? cellFocusOf(target, view) : null) : lineageOf(focus.key, recipeWires)) : null;
  const crossed = (key: string): boolean => !!target && focus.key?.startsWith('f') === true && target.withered.some((parent) => `n${parent}` === key);
  const shade = (key: string): number => (lit && !lit.has(key) ? 1 - focus.level * (1 - (crossed(key) ? CROSSED : DIM)) : 1);

  for (const wire of [...recipeWires, ...cellWires]) {
    const parents = wire.parents.map((parent) => spots.get(parent)).filter((at): at is Spot => !!at);
    if (parents.length === 0) continue;
    const raised = lit?.has(wire.key) ? wire.alpha + (1 - wire.alpha) * focus.level : wire.alpha;
    ctx.globalAlpha = raised * shade(wire.key);
    drawJoin(ctx, parents, wire.target, wire.fate, time);
  }
  ctx.globalAlpha = 1;

  for (const node of nodes) {
    const dim = shade(keyOf(node));
    if (node.kind === 'cell') {
      const { cell, at } = node;
      ctx.globalAlpha = dim;
      drawDormant(ctx, at, cell.step, cell.sockets, cell.attached.length, time, cell.index);
      if (focused === cell.index) ringAround(ctx, at, SOMA + 9, MIND.light, 3);
      if (whole(cell)) {
        const job = view.hypotheses.find((hypothesis) => !hypothesis.order && hypothesis.result === cell.index);
        caption(ctx, job && job.tryer >= 0 ? (PERSON_NAMES[job.tryer] ?? 'someone') : 'waiting', at, MIND.light, SOMA + 9);
      }
      ctx.globalAlpha = 1;
      continue;
    }
    const { neuron, at } = node;
    const strength = 1;
    const flash = flashes.get(neuron.index);
    if (flash !== undefined && time - flash < 1.2) ringAround(ctx, at, SOMA + 2 + (time - flash) * 22, MIND.white, 2);
    ctx.globalAlpha = dim;
    drawCell(ctx, at, strength, iconOf(neuronOf(neuron.index).id), time);
    ctx.globalAlpha = dim;
    caption(ctx, neuronOf(neuron.index).label, at, MIND.bright);
    ctx.globalAlpha = 1;
    if (crossed(`n${neuron.index}`)) {
      ctx.globalAlpha = focus.level;
      drawCross(ctx, at);
      ctx.globalAlpha = 1;
    }
  }

  for (const judged of scene.judged) {
    if (judged.fate === 'waiting') {
      drawTrail(ctx, judged.path, judged.heading, time, false, true);
      continue;
    }
    if (judged.fate !== 'withered') continue;
    const progress = Math.min(1, (time - judged.since) / WITHER_SECONDS);
    ctx.globalAlpha = 1 - progress;
    const fallen = droop(judged.path, progress);
    const from = fallen[0];
    const to = fallen[fallen.length - 1];
    if (from && to) drawFibre(ctx, from, to, 3 + progress * 6, 'dead', time, true);
    ctx.globalAlpha = 1;
  }

  const start = drag ? spots.get(drag.from) : undefined;
  if (drag && start && drag.path.length > 1) drawTrail(ctx, drag.path, drag.heading, time, true, arrived(drag, hover));
  else if (retract) {
    const left = 1 - (time - retract.at) / RETRACT_SECONDS;
    if (left > 0) drawTrail(ctx, retract.path.slice(0, Math.max(1, Math.floor(retract.path.length * left))), retract.heading, time, false, false);
  }

  if (hover && drag && arrived(drag, hover)) ringAround(ctx, hover.at, SOMA + 5, MIND.white, 1);
  else if (hover) ringAround(ctx, hover.at, SOMA + 3, MIND.light, 2);
  return nodes;
}

export function MindTree({ host, onHover, focusCell }: { host: MindHost; onHover: (text: string) => void; focusCell?: number | null }): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const asked = useRef<number | null>(focusCell ?? null);
  asked.current = focusCell ?? null;

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext('2d');
    if (!element || !ctx) return undefined;
    element.width = TREE_WIDTH;
    element.height = TREE_HEIGHT;

    let nodes: Node[] = [];
    let drag: Drag | null = null;
    let retract: Retract | null = null;
    let judged: Judged[] = [];
    let hover: Node | null = null;
    let focused: number | null = asked.current;
    let lastAsked: number | null = asked.current;
    let shown = '';
    let handle = 0;
    const flashes = new Map<number, number>();
    const levels = new Map<number, number>();
    const started = performance.now();
    const now = (): number => (performance.now() - started) / 1000;

    const camera = { zoom: 1, x: 0, y: 0 };
    let panning: { startX: number; startY: number; fromX: number; fromY: number; moved: boolean } | null = null;

    const screenOf = (clientX: number, clientY: number): Spot => {
      const rect = element.getBoundingClientRect();
      return { x: ((clientX - rect.left) * TREE_WIDTH) / rect.width, y: ((clientY - rect.top) * TREE_HEIGHT) / rect.height };
    };
    const clampCamera = (): void => {
      camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom));
      camera.x = Math.max(TREE_WIDTH - TREE_WIDTH * camera.zoom, Math.min(0, camera.x));
      camera.y = Math.max(TREE_HEIGHT - TREE_HEIGHT * camera.zoom, Math.min(0, camera.y));
    };
    const pointOf = (event: PointerEvent): Spot => {
      const at = screenOf(event.clientX, event.clientY);
      return { x: (at.x - camera.x) / camera.zoom, y: (at.y - camera.y) / camera.zoom };
    };

    const focus: Focus = { key: null, level: 0, at: 0 };

    const onDown = (event: PointerEvent): void => {
      const point = pointOf(event);
      const hit = hitOf(nodes, point);
      if (event.button === 2) {
        focused = null;
        return;
      }
      if (!hit) {
        const at = screenOf(event.clientX, event.clientY);
        element.setPointerCapture(event.pointerId);
        panning = { startX: at.x, startY: at.y, fromX: camera.x, fromY: camera.y, moved: false };
        return;
      }
      if (hit.kind === 'cell') {
        focused = hit.cell.index;
        const job = host.view()?.hypotheses.find((hypothesis) => !hypothesis.order && hypothesis.result === hit.cell.index);
        if (job && job.tryer >= 0) host.lookAt(job.tryer);
        return;
      }
      if (!host.view()?.curious) return;
      element.setPointerCapture(event.pointerId);
      const toward = focused === null ? null : nodes.find((node) => node.kind === 'cell' && node.cell.index === focused);
      const heading = toward ? Math.atan2(toward.at.y - hit.at.y, toward.at.x - hit.at.x) : Math.atan2(hit.at.y - CENTRE_Y, hit.at.x - CENTRE_X);
      drag = { from: hit.neuron.index, startedAt: now(), pointer: point, path: [], heading, at: now(), carry: 0 };
      retract = null;
    };

    const onMove = (event: PointerEvent): void => {
      if (panning) {
        const at = screenOf(event.clientX, event.clientY);
        if (Math.hypot(at.x - panning.startX, at.y - panning.startY) > 3) panning.moved = true;
        camera.x = panning.fromX + (at.x - panning.startX);
        camera.y = panning.fromY + (at.y - panning.startY);
        clampCamera();
        return;
      }
      const point = pointOf(event);
      hover = hitOf(nodes, point);
      if (drag) drag.pointer = point;
    };

    const onUp = (event: PointerEvent): void => {
      if (panning) {
        if (!panning.moved) focused = null;
        panning = null;
        return;
      }
      if (!drag) return;
      const point = pointOf(event);
      drag.at = now();
      const target = hitOf(nodes, point);
      if (arrived(drag, target) && target?.kind === 'cell') {
        const { cell } = target;
        focused = cell.index;
        judged.push({ cell: cell.index, parent: drag.from, path: drag.path, heading: drag.heading, at: now(), attached: cell.attached.length, withered: cell.withered.length, fate: 'waiting', since: now() });
        host.attach(cell.index, drag.from);
      } else if (drag.path.length > 1) retract = { path: drag.path, heading: drag.heading, at: now() };
      drag = null;
    };

    const onLeave = (): void => {
      hover = null;
    };

    const onMenu = (event: Event): void => event.preventDefault();

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const at = screenOf(event.clientX, event.clientY);
      const world = { x: (at.x - camera.x) / camera.zoom, y: (at.y - camera.y) / camera.zoom };
      camera.zoom *= Math.exp(-event.deltaY * 0.0018);
      camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom));
      camera.x = at.x - world.x * camera.zoom;
      camera.y = at.y - world.y * camera.zoom;
      clampCamera();
    };

    const fit = (): void => {
      const view = host.view();
      let reach = 90;
      for (const node of view ? nodesOf(view) : []) reach = Math.max(reach, Math.hypot(node.at.x - CENTRE_X, node.at.y - CENTRE_Y) + 40);
      reach = Math.min(reach, BRAIN_RADIUS + 40);
      camera.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, TREE_HEIGHT / (reach * 2)));
      camera.x = TREE_WIDTH / 2 - CENTRE_X * camera.zoom;
      camera.y = TREE_HEIGHT / 2 - CENTRE_Y * camera.zoom;
      clampCamera();
    };
    fit();

    const judge = (view: MindView, time: number): void => {
      for (const one of judged) {
        if (one.fate !== 'waiting') continue;
        const cell = view.cells.find((candidate) => candidate.index === one.cell);
        if (cell && cell.withered.length > one.withered) {
          one.fate = 'withered';
          one.since = time;
        } else if (!cell || cell.attached.length > one.attached || time - one.at > JUDGE_PATIENCE_SECONDS) {
          one.fate = 'taken';
          one.since = time;
        }
      }
      judged = judged.filter((one) => one.fate === 'waiting' || (one.fate === 'withered' && time - one.since < WITHER_SECONDS));
    };

    const frame = (): void => {
      handle = requestAnimationFrame(frame);
      const time = now();
      const view = host.view();
      if (asked.current !== lastAsked) {
        lastAsked = asked.current;
        if (asked.current !== null) focused = asked.current;
      }
      if (view) {
        for (const neuron of view.neurons) {
          if (levels.has(neuron.index) === false && levels.size > 0) flashes.set(neuron.index, time);
          levels.set(neuron.index, 1);
        }
        if (focused !== null && !view.cells.some((cell) => cell.index === focused)) focused = null;
        judge(view, time);
      }
      if (drag) {
        const origin = nodes.find((node) => node.kind === 'neuron' && node.neuron.index === drag?.from);
        if (origin) grow(drag, origin.at, time);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = MIND.deep;
      ctx.fillRect(0, 0, TREE_WIDTH, TREE_HEIGHT);
      ctx.setTransform(camera.zoom, 0, 0, camera.zoom, camera.x, camera.y);
      element.style.cursor = panning ? 'grabbing' : hover ? 'pointer' : 'grab';
      const elapsed = Math.min(0.1, time - focus.at);
      focus.at = time;
      const wanted = !drag && hover?.kind === 'neuron' ? keyOf(hover) : focused !== null ? `f${focused}` : null;
      if (wanted) {
        if (focus.key !== wanted && focus.key?.startsWith('f') !== wanted.startsWith('f')) focus.level = Math.min(focus.level, 0.5);
        focus.key = wanted;
        focus.level = Math.min(1, focus.level + elapsed * FOCUS_RISE);
      } else focus.level = Math.max(0, focus.level - elapsed * FOCUS_FALL);
      nodes = drawTree(ctx, { view, time, drag, retract, judged, hover, flashes, focus, focused });
      const held = hover;
      if (held) hover = nodes.find((node) => keyOf(node) === keyOf(held)) ?? null;
      const focusedCell = focused === null ? null : (view?.cells.find((cell) => cell.index === focused) ?? null);
      const text = view ? describe(view, hover, focusedCell) : '';
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
    element.addEventListener('dblclick', fit);
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
      element.removeEventListener('dblclick', fit);
    };
  }, [host, onHover]);

  return <canvas ref={canvas} className="se-mind-tree" />;
}

const partsOf = (parents: readonly number[]): string => parents.map(nameOf).join(' + ');

function WorkLine({ hypothesis, host }: { hypothesis: HypothesisView; host: MindHost }): React.JSX.Element {
  const name = (person: number): string => PERSON_NAMES[person] ?? 'someone';
  const who = hypothesis.tryer < 0 ? 'nobody fit' : name(hypothesis.tryer);
  const what = hypothesis.order ? `make ${RECIPES.find((recipe) => neuronIndex(recipe.result) === hypothesis.result)?.title.toLowerCase() ?? 'it'}` : `new idea: ${partsOf(hypothesis.parents)}`;

  return (
    <div className="se-mind-line">
      <button type="button" className="se-mind-row" disabled={hypothesis.tryer < 0} title={hypothesis.tryer < 0 ? 'nobody has taken it yet' : 'show who is working on it'} onClick={() => host.lookAt(hypothesis.tryer)}>
        <PixelText className="se-mind-pair">{what}</PixelText>
        <PixelText className="se-mind-who">{who}</PixelText>
        <PixelText className="se-mind-note">{hypothesis.note}</PixelText>
      </button>
      {hypothesis.order && hypothesis.tryer < 0 ? (
        <button type="button" className="se-tile" aria-label="drop this order" title="drop this order" onClick={() => host.forget(hypothesis.id)}>
          <PixelText>x</PixelText>
        </button>
      ) : null}
    </div>
  );
}

export function MindPanel({ open, view, host, onClose, focusCell }: { open: boolean; view: MindView | null; host: MindHost; onClose: () => void; focusCell?: number | null }): React.JSX.Element | null {
  const [hint, setHint] = useState('');
  if (!open) return null;

  const working = view?.hypotheses.filter((hypothesis) => hypothesis.state === State.Open) ?? [];
  const known = RECIPES.filter((recipe) => view?.neurons.some((neuron) => neuron.index === neuronIndex(recipe.result)));
  const forming = view?.cells.filter((cell) => cell.step === Step.Heartbeat && !whole(cell)).length ?? 0;
  const curiosity = view ? Math.round((1 - view.weariness) * 100) : 100;

  return (
    <div className="se-mind-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="se-board se-mind">
        <header className="se-person-head">
          <PixelHeading>mind</PixelHeading>
          <PixelText className="se-mind-curiosity">{view && !view.curious ? 'nobody has the mind for it' : `curiosity ${curiosity}%`}</PixelText>
          <button type="button" className="se-tile" onClick={onClose}>
            <PixelText>close</PixelText>
          </button>
        </header>
        <MindTree host={host} onHover={setHint} focusCell={focusCell ?? null} />
        <div className="se-mind-hint">
          <PixelBody>{hint || ' '}</PixelBody>
        </div>
        <div className="se-section">
          <PixelText>working on</PixelText>
        </div>
        <div className="se-mind-work">
          {working.length === 0 ? <PixelText>{forming > 0 ? `${forming} new idea${forming === 1 ? ' is' : 's are'} forming. click a beating cell and give it its fibres` : 'nothing yet. a dark cell is something to find'}</PixelText> : working.map((hypothesis) => <WorkLine key={hypothesis.id} hypothesis={hypothesis} host={host} />)}
        </div>
        <div className="se-section">
          <PixelText>recipes</PixelText>
        </div>
        <div className="se-mind-recipes">
          {known.length === 0 ? <PixelText>none proven</PixelText> : null}
          {known.map((recipe) => (
            <div key={recipe.title} className="se-mind-recipe" title={recipe.words}>
              <PixelIcon name={iconOf(recipe.result)} />
              <PixelText>{`${recipe.title}: ${recipe.parents.join(' + ')}`}</PixelText>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
