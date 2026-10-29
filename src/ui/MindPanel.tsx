import { useEffect, useRef, useState } from 'react';
import { MIND } from '../render/palette.ts';
import type { HypothesisView, MindView, NeuronView } from '../sim/mind/mind.ts';
import { DEAD_SECONDS, State } from '../sim/mind/mind.ts';
import { placeOf, savePlaces, setPlace } from './mindLayout.ts';
import { NEURONS, Outcome, recipeFor, ringOf, RECIPES, neuronIndex, neuronOf } from '../sim/mind/neurons.ts';
import { PERSON_NAMES } from '../sim/people/thoughts.ts';
import {
  HIT_RADIUS,
  HOLD_SECONDS,
  QUERY_GLYPH,
  SOMA,
  TREE_HEIGHT,
  TREE_WIDTH,
  caption,
  dot,
  CENTRE_X,
  CENTRE_Y,
  drawBackdrop,
  drawCore,
  drawWitheredCell,
  rim,
  sectorsOf,
  drawCell,
  drawLink,
  drawTrail,
  iconOf,
  nameOf,
  ringAround,
  spotOf,
} from './mindArt.ts';
import type { MindHost, Spot } from './mindArt.ts';
import { PixelBody, PixelHeading, PixelIcon, PixelText } from './pixel/Pixel.tsx';

type Node = { kind: 'neuron'; neuron: NeuronView; at: Spot } | { kind: 'query'; hypothesis: HypothesisView; at: Spot };

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

const MIN_ZOOM = 1;

const MAX_ZOOM = 3.5;

const RETRACT_SECONDS = 0.45;

const GROW_SPEED = 38;

const TURN_PER_PIXEL = 0.06;

const grow = (drag: Drag, start: Spot, time: number): void => {
  const elapsed = Math.min(0.05, Math.max(0, time - drag.at));
  drag.at = time;
  if (drag.path.length === 0) drag.path.push({ x: start.x + Math.cos(drag.heading) * (SOMA + 1), y: start.y + Math.sin(drag.heading) * (SOMA + 1) });
  const idle = Math.hypot(drag.pointer.x - start.x, drag.pointer.y - start.y) < HIT_RADIUS && drag.path.length < 10;
  if (idle) return;
  drag.carry += GROW_SPEED * elapsed;
  const steps = Math.floor(drag.carry);
  drag.carry -= steps;
  for (let step = 0; step < steps; step += 1) {
    const tip = drag.path[drag.path.length - 1]!;
    const gap = Math.hypot(drag.pointer.x - tip.x, drag.pointer.y - tip.y);
    if (gap < 2) break;
    const want = Math.atan2(drag.pointer.y - tip.y, drag.pointer.x - tip.x);
    let turn = want - drag.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    drag.heading += Math.max(-TURN_PER_PIXEL, Math.min(TURN_PER_PIXEL, turn)) + (Math.sin(drag.path.length * 0.19 + drag.from) * 0.1 + Math.sin(drag.path.length * 0.53) * 0.06);
    drag.path.push({ x: tip.x + Math.cos(drag.heading), y: tip.y + Math.sin(drag.heading) });
  }
};

const arrived = (drag: Drag, target: Node | null): boolean => {
  if (!target || target.kind !== 'neuron' || !target.neuron.holders.some((level) => level >= 2)) return false;
  if (target.neuron.index === drag.from) return drag.path.length < 12 && drag.at - drag.startedAt >= HOLD_SECONDS;
  const tip = drag.path[drag.path.length - 1];
  return !!tip && Math.hypot(tip.x - target.at.x, tip.y - target.at.y) < HIT_RADIUS;
};

const spotFor = (index: number): Spot => {
  const place = placeOf(index);
  return spotOf(place.angle, place.ring);
};

function nodesOf(view: MindView, editing: boolean): Node[] {
  const nodes: Node[] = [];
  const seen = new Set<number>();
  for (const neuron of view.neurons) {
    seen.add(neuron.index);
    nodes.push({ kind: 'neuron', neuron, at: spotFor(neuron.index) });
  }
  if (editing) {
    NEURONS.forEach((_, index) => {
      if (!seen.has(index)) nodes.push({ kind: 'neuron', neuron: { index, x: 0, y: 0, holders: [], proven: false }, at: spotFor(index) });
    });
  }
  for (const hypothesis of view.hypotheses) {
    if (hypothesis.order || hypothesis.state === State.Success || hypothesis.state === State.Weak) continue;
    const known = recipeFor(hypothesis.a, hypothesis.b);
    const home = known ? neuronIndex(known.result) : -1;
    if (home >= 0 && !seen.has(home)) {
      nodes.push({ kind: 'query', hypothesis, at: spotFor(home) });
      continue;
    }
    const one = nodes.find((node) => node.kind === 'neuron' && node.neuron.index === hypothesis.a);
    const two = nodes.find((node) => node.kind === 'neuron' && node.neuron.index === hypothesis.b);
    if (!one || !two) {
      nodes.push({ kind: 'query', hypothesis, at: spotOf(hypothesis.x, hypothesis.y) });
      continue;
    }
    const mid = { x: (one.at.x + two.at.x) / 2, y: (one.at.y + two.at.y) / 2 };
    const out = Math.hypot(mid.x - CENTRE_X, mid.y - CENTRE_Y) || 1;
    nodes.push({ kind: 'query', hypothesis, at: { x: Math.round(mid.x + ((mid.x - CENTRE_X) / out) * 38), y: Math.round(mid.y + ((mid.y - CENTRE_Y) / out) * 38) } });
  }
  return nodes;
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

const holdersOf = (neuron: NeuronView): number => neuron.holders.filter((level) => level >= 2).length;

function describe(view: MindView, node: Node | null): string {
  if (!node) return 'drag from a thing to grow a link. wheel zooms, drag the background pans';
  if (node.kind === 'query') {
    const { hypothesis } = node;
    const who = hypothesis.tryer >= 0 ? `${PERSON_NAMES[hypothesis.tryer] ?? 'someone'}: ` : '';
    return `${nameOf(hypothesis.a)} + ${nameOf(hypothesis.b)}, ${hypothesis.state === State.Scar ? 'dead end' : `${who}${hypothesis.note}`}`;
  }
  const { neuron } = node;
  const knows = holdersOf(neuron);
  const heard = neuron.holders.filter((level) => level === 1).length;
  const names = neuron.holders.map((level, person) => (level >= 2 ? (PERSON_NAMES[person] ?? 'someone') : null)).filter(Boolean);
  const text = knows === 0 ? 'only heard of' : view.people > 1 && knows < view.people ? `${knows} knows: ${names.join(', ')}` : view.people > 1 ? 'everyone knows' : 'known';
  return `${neuronOf(neuron.index).label}, ${text}${heard > 0 && knows > 0 ? `, ${heard} heard of` : ''}`;
}

function drawTree(ctx: CanvasRenderingContext2D, host: MindHost, view: MindView | null, fadeOf: (hypothesis: HypothesisView) => number, editing: boolean, time: number, drag: Drag | null, retract: Retract | null, hover: Node | null, flashes: Map<number, number>): Node[] {
  drawBackdrop(ctx, time, sectorsOf((view?.neurons ?? []).map((neuron) => neuron.x)));
  drawCore(ctx, time);
  if (!view) return [];

  const nodes = nodesOf(view, editing);
  const spots = new Map<number, Spot>();
  for (const node of nodes) if (node.kind === 'neuron') spots.set(node.neuron.index, node.at);
  const selected = host.selected();

  if (editing) {
    ctx.globalAlpha = 0.45;
    for (const recipe of RECIPES) {
      const from = spots.get(neuronIndex(recipe.a));
      const to = spots.get(neuronIndex(recipe.b));
      const result = spots.get(neuronIndex(recipe.result));
      if (!from || !to || !result) continue;
      for (const parent of [from, to]) drawLink(ctx, rim(parent, result), rim(result, parent), 5, recipe.outcome === Outcome.Success ? 'fixed' : 'weak', time);
    }
    ctx.globalAlpha = 1;
  }

  for (const hypothesis of view.hypotheses) {
    if (hypothesis.order) continue;
    const here = nodes.find((node) => node.kind === 'query' && node.hypothesis.id === hypothesis.id)?.at ?? spotOf(hypothesis.x, hypothesis.y);
    const fate = hypothesis.state === State.Open ? 'pulsing' : hypothesis.state === State.Scar ? 'dead' : hypothesis.state === State.Weak ? 'weak' : 'fixed';
    const target = hypothesis.state === State.Open || hypothesis.state === State.Scar ? here : (spots.get(hypothesis.result) ?? here);
    for (const [at, parent] of [hypothesis.a, hypothesis.b].entries()) {
      const from = spots.get(parent);
      if (!from) continue;
      const bend = (at === 0 ? -1 : 1) * (hypothesis.a === hypothesis.b ? 22 : 8);
      ctx.globalAlpha = fate === 'dead' ? fadeOf(hypothesis) : 1;
      drawLink(ctx, rim(from, target), rim(target, from), bend, fate, time);
      ctx.globalAlpha = 1;
    }
  }

  for (const node of nodes) {
    if (node.kind === 'query') {
      const { hypothesis, at } = node;
      if (hypothesis.state === State.Scar) {
        ctx.globalAlpha = fadeOf(hypothesis);
        drawWitheredCell(ctx, at, time);
        caption(ctx, 'dead end', at, MIND.wither);
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(time * 5 + hypothesis.id);
      drawCell(ctx, at, 1, null, time, QUERY_GLYPH);
      ctx.globalAlpha = 1;
      caption(ctx, hypothesis.tryer >= 0 ? (PERSON_NAMES[hypothesis.tryer] ?? 'someone') : 'waiting', at, MIND.light);
      continue;
    }
    const { neuron, at } = node;
    const solid = holdersOf(neuron);
    const share = view.people > 0 ? solid / view.people : 1;
    const strength = solid === 0 ? 0.3 : 0.5 + 0.5 * share;
    const flash = flashes.get(neuron.index);
    if (flash !== undefined && time - flash < 1.2) ringAround(ctx, at, SOMA + 2 + (time - flash) * 22, MIND.white, 2);
    ctx.globalAlpha = share < 1 && Math.floor(time * 4 + neuron.index) % 7 === 0 ? strength * 0.7 : Math.min(1, 0.4 + strength);
    drawCell(ctx, at, strength, iconOf(neuronOf(neuron.index).id), time);
    ctx.globalAlpha = 1;
    if (selected >= 0 && (neuron.holders[selected] ?? 0) >= 1) ringAround(ctx, at, SOMA + 4, MIND.white, 2);
    caption(ctx, neuronOf(neuron.index).label, at, solid === 0 ? MIND.mute : MIND.bright);
    if (view.people > 1 && solid > 0 && solid < view.people) caption(ctx, solid === 1 ? '1 knows' : `${solid} know`, at, MIND.glow, SOMA + 15);
    else if (solid === 0 && !editing) caption(ctx, 'heard of', at, MIND.mute, SOMA + 15);
  }

  const start = drag ? spots.get(drag.from) : retract ? ({ x: 0, y: 0 } as Spot) : undefined;
  if (start) {
    if (drag) {
      const grown = Math.min(1, (time - drag.startedAt) / HOLD_SECONDS);
      const onSelf = Math.hypot(drag.pointer.x - start.x, drag.pointer.y - start.y) < HIT_RADIUS;
      if (onSelf) {
        const steps = Math.ceil(grown * 70);
        for (let step = 0; step < steps; step += 1) {
          const angle = -Math.PI / 2 + (step / 70) * Math.PI * 2;
          dot(ctx, start.x + Math.cos(angle) * (SOMA + 5), start.y + Math.sin(angle) * (SOMA + 5), step % 3 === 0 ? MIND.white : MIND.light);
        }
      }
      if (!onSelf || drag.path.length > 1) drawTrail(ctx, drag.path, drag.heading, time, true, arrived(drag, hover));
    } else if (retract) {
      const left = 1 - (time - retract.at) / RETRACT_SECONDS;
      if (left > 0) drawTrail(ctx, retract.path.slice(0, Math.max(1, Math.floor(retract.path.length * left))), retract.heading, time, false, false);
    }
  }

  if (hover && drag && arrived(drag, hover)) ringAround(ctx, hover.at, SOMA + 5, MIND.white, 1);
  else if (hover) ringAround(ctx, hover.at, SOMA + 3, MIND.light, 2);
  return nodes;
}

export function MindTree({ host, onHover, editing, onMoved }: { host: MindHost; onHover: (text: string) => void; editing: boolean; onMoved?: () => void }): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext('2d');
    if (!element || !ctx) return undefined;
    element.width = TREE_WIDTH;
    element.height = TREE_HEIGHT;

    let nodes: Node[] = [];
    let drag: Drag | null = null;
    let retract: Retract | null = null;
    let hover: Node | null = null;
    let shown = '';
    let handle = 0;
    const flashes = new Map<number, number>();
    const aged = new Map<number, { age: number; at: number }>();
    const fadeOf = (hypothesis: HypothesisView): number => {
      const known = aged.get(hypothesis.id);
      if (!known || known.age !== hypothesis.age) aged.set(hypothesis.id, { age: hypothesis.age, at: now() });
      const seen = aged.get(hypothesis.id)!;
      return Math.max(0.08, 1 - (hypothesis.age + (now() - seen.at)) / DEAD_SECONDS);
    };
    const levels = new Map<number, number>();
    const started = performance.now();

    const camera = { zoom: 1, x: 0, y: 0 };
    let panning: { startX: number; startY: number; fromX: number; fromY: number } | null = null;

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
    const now = (): number => (performance.now() - started) / 1000;

    let moving: number | null = null;

    const onDown = (event: PointerEvent): void => {
      const point = pointOf(event);
      const hit = hitOf(nodes, point);
      if (editing && hit?.kind === 'neuron' && event.button === 0) {
        element.setPointerCapture(event.pointerId);
        moving = hit.neuron.index;
        return;
      }
      if (event.button === 2 && hit?.kind === 'query' && hit.hypothesis.tryer < 0) {
        host.forget(hit.hypothesis.id);
        return;
      }
      if (hit?.kind === 'query' && hit.hypothesis.tryer >= 0) host.lookAt(hit.hypothesis.tryer);
      if (!hit && event.button !== 2) {
        const at = screenOf(event.clientX, event.clientY);
        element.setPointerCapture(event.pointerId);
        panning = { startX: at.x, startY: at.y, fromX: camera.x, fromY: camera.y };
        return;
      }
      if (!hit || hit.kind !== 'neuron' || hit.neuron.holders.every((level) => level < 2)) return;
      element.setPointerCapture(event.pointerId);
      drag = { from: hit.neuron.index, startedAt: now(), pointer: point, path: [], heading: Math.atan2(hit.at.y - CENTRE_Y, hit.at.x - CENTRE_X), at: now(), carry: 0 };
      retract = null;
    };

    const onMove = (event: PointerEvent): void => {
      if (moving !== null) {
        const at = pointOf(event);
        const dx = at.x - CENTRE_X;
        const dy = at.y - CENTRE_Y;
        const ring = ringOf(Math.hypot(dx, dy));
        setPlace(moving, { angle: ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360, ring: event.shiftKey ? Math.round(ring) : ring });
        return;
      }
      if (panning) {
        const at = screenOf(event.clientX, event.clientY);
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
      panning = null;
      if (moving !== null) {
        moving = null;
        savePlaces();
        onMoved?.();
        return;
      }
      if (!drag) return;
      const point = pointOf(event);
      drag.at = now();
      const target = hitOf(nodes, point);
      if (arrived(drag, target) && target?.kind === 'neuron') host.wonder(drag.from, target.neuron.index);
      else if (drag.path.length > 1) retract = { path: drag.path, heading: drag.heading, at: now() };
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
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const neuron of NEURONS) {
        const at = spotOf(neuron.angle, neuron.ring);
        minX = Math.min(minX, at.x);
        maxX = Math.max(maxX, at.x);
        minY = Math.min(minY, at.y);
        maxY = Math.max(maxY, at.y);
      }
      const margin = 56;
      camera.zoom = Math.min(MAX_ZOOM, Math.min(TREE_WIDTH / (maxX - minX + margin * 2), TREE_HEIGHT / (maxY - minY + margin * 2)));
      camera.x = TREE_WIDTH / 2 - ((minX + maxX) / 2) * camera.zoom;
      camera.y = TREE_HEIGHT / 2 - ((minY + maxY) / 2) * camera.zoom;
      clampCamera();
    };
    const onReset = fit;
    fit();

    const frame = (): void => {
      handle = requestAnimationFrame(frame);
      const time = now();
      const view = host.view();
      if (view) {
        for (const neuron of view.neurons) {
          const level = neuron.holders.reduce((sum, value) => sum + value, 0);
          if (levels.has(neuron.index) && level > (levels.get(neuron.index) ?? 0)) flashes.set(neuron.index, time);
          levels.set(neuron.index, level);
        }
      }
      if (drag) {
        const origin = nodes.find((node) => node.kind === 'neuron' && node.neuron.index === drag?.from);
        if (origin) grow(drag, origin.at, time);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = MIND.deep;
      ctx.fillRect(0, 0, TREE_WIDTH, TREE_HEIGHT);
      ctx.setTransform(camera.zoom, 0, 0, camera.zoom, camera.x, camera.y);
      element.style.cursor = panning || moving !== null ? 'grabbing' : hover ? (editing ? 'move' : 'pointer') : 'grab';
      nodes = drawTree(ctx, host, view, fadeOf, editing, time, drag, retract, hover, flashes);
      const text = view ? describe(view, hover) : '';
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
    element.addEventListener('dblclick', onReset);
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
      element.removeEventListener('dblclick', onReset);
    };
  }, [host, onHover, editing, onMoved]);

  return <canvas ref={canvas} className="se-mind-tree" />;
}

function WorkLine({ hypothesis, host }: { hypothesis: HypothesisView; host: MindHost }): React.JSX.Element {
  const name = (person: number): string => PERSON_NAMES[person] ?? 'someone';
  const who =
    hypothesis.tryer < 0 ? 'nobody fit' : hypothesis.partner >= 0 ? `${name(hypothesis.tryer)} -> ${name(hypothesis.partner)}` : name(hypothesis.tryer);
  const pair = hypothesis.order ? `make ${RECIPES.find((recipe) => neuronIndex(recipe.result) === hypothesis.result)?.title.toLowerCase() ?? 'it'}` : `${nameOf(hypothesis.a)} + ${nameOf(hypothesis.b)}`;

  return (
    <div className="se-mind-line">
      <button
        type="button"
        className="se-mind-row"
        disabled={hypothesis.tryer < 0}
        title={hypothesis.tryer < 0 ? 'nobody has taken it yet' : 'show who is working on it'}
        onClick={() => host.lookAt(hypothesis.tryer)}
      >
        <PixelText className="se-mind-pair">{pair}</PixelText>
        <PixelText className="se-mind-who">{who}</PixelText>
        <PixelText className="se-mind-note">{hypothesis.note}</PixelText>
      </button>
      {hypothesis.tryer < 0 ? (
        <button type="button" className="se-tile" aria-label="drop this guess" title="drop this guess" onClick={() => host.forget(hypothesis.id)}>
          <PixelText>x</PixelText>
        </button>
      ) : null}
    </div>
  );
}

export function MindPanel({ open, view, host, onClose }: { open: boolean; view: MindView | null; host: MindHost; onClose: () => void }): React.JSX.Element | null {
  const [hint, setHint] = useState('');
  if (!open) return null;

  const working = view?.hypotheses.filter((hypothesis) => hypothesis.state === State.Open) ?? [];
  const known = RECIPES.filter((recipe) => recipe.outcome === Outcome.Success && view?.neurons.some((neuron) => neuron.index === neuronIndex(recipe.result) && neuron.proven));

  return (
    <div className="se-mind-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="se-board se-mind">
      <header className="se-person-head">
        <PixelHeading>mind</PixelHeading>
        <button type="button" className="se-tile" onClick={onClose}>
          <PixelText>close</PixelText>
        </button>
      </header>
      <MindTree host={host} onHover={setHint} editing={false} />
      <div className="se-mind-hint">
        <PixelBody>{hint || ' '}</PixelBody>
      </div>
      <div className="se-section">
        <PixelText>working on</PixelText>
      </div>
      <div className="se-mind-work">
        {working.length === 0 ? <PixelText>nothing yet. a guess is a link dragged between two things</PixelText> : working.map((hypothesis) => <WorkLine key={hypothesis.id} hypothesis={hypothesis} host={host} />)}
      </div>
      <div className="se-section">
        <PixelText>recipes</PixelText>
      </div>
      <div className="se-mind-recipes">
        {known.length === 0 ? <PixelText>none proven</PixelText> : null}
        {known.map((recipe) => (
          <div key={recipe.title} className="se-mind-recipe" title={recipe.words}>
            <PixelIcon name={iconOf(recipe.result)} />
            <PixelText>{`${recipe.title}: ${recipe.a} + ${recipe.b}`}</PixelText>
          </div>
        ))}
      </div>
    </aside>
    </div>
  );
}
