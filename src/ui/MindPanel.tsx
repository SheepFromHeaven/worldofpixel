import { useCallback, useEffect, useRef, useState } from 'react';
import { MIND } from '../render/palette.ts';
import type { HypothesisView, MindView } from '../sim/mind/mind.ts';
import { State } from '../sim/mind/mind.ts';
import { REGIONS } from '../content/research/regions.ts';
import { NEURONS, RECIPES, neuronIndex, neuronOf, parentsOf } from '../sim/mind/neurons.ts';
import { PERSON_NAMES } from '../sim/people/thoughts.ts';
import {
  CENTRE_X,
  CENTRE_Y,
  HIT_RADIUS,
  IDEA,
  QUESTION,
  SOMA,
  TREE_HEIGHT,
  TREE_WIDTH,
  caption,
  drawBackdrop,
  drawCell,
  drawCross,
  drawFibre,
  drawIdea,
  iconOf,
  nameOf,
  ringAround,
  rim,
  socketAt,
} from './mindArt.ts';
import type { MindHost, Spot } from './mindArt.ts';
import { ReviewTree } from './MindReview.tsx';
import { drawBrain, labelOf, regionAt, regionCentre } from './mindBrain.ts';
import type { RegionState } from './mindBrain.ts';
import { PixelBody, PixelHeading, PixelIcon, PixelText } from './pixel/Pixel.tsx';

const ORBIT_FIRST = 130;

const BUBBLE_ORBIT = 86;

const BUBBLE_TURN = 0.1;

const ORBIT_GAP = 46;

const ORBIT_SPACING = 44;

const ORBIT_TURN = 0.03;

const SEAT_REACH = IDEA + 37;

const SETTLE = 6;

const GROW_SECONDS = 0.45;

const PENDING_SECONDS = 2.5;

const WITHER_SECONDS = 1.6;

const MERGE_HOLD = 0.5;
const MERGE_SECONDS = 1;
const FORM_SECONDS = GROW_SECONDS + MERGE_HOLD + MERGE_SECONDS;

const BURST_SECONDS = 0.9;

const LEAVE_SECONDS = 0.5;

const WITHERED_ALPHA = 0.3;

const OLD_ALPHA = 0.62;

const seen = { value: null as number | null };

const mostOf = (view: MindView | null): number => view?.neurons.reduce((most, neuron) => Math.max(most, neuron.order), 0) ?? 0;

const CENTRE: Spot = { x: CENTRE_X, y: CENTRE_Y };

interface Pending {
  parent: number;
  since: number;
  held: number;
}

interface Dying {
  parent: number;
  socket: number;
  since: number;
  at: Spot;
}

interface Copy {
  neuron: number;
  at: Spot;
}

interface Leaving extends Copy {
  since: number;
}

type Hover = number | 'idea' | `b${number}` | null;

interface Burst {
  at: Spot;
  since: number;
}

interface Formed {
  parents: readonly number[];
  since: number;
}

function orbitOf(neurons: readonly number[], orders: ReadonlyMap<number, number>, time: number): Map<number, Spot> {
  const order = [...neurons].sort((a, b) => (orders.get(a) ?? 0) - (orders.get(b) ?? 0) || a - b);
  const seats = new Map<number, Spot>();
  let placed = 0;
  for (let ring = 0; placed < order.length; ring += 1) {
    const radius = ORBIT_FIRST + ring * ORBIT_GAP;
    const count = Math.min(order.length - placed, Math.max(6, Math.floor((Math.PI * 2 * radius) / ORBIT_SPACING)));
    const turn = time * ORBIT_TURN * (ring % 2 === 0 ? 1 : -1) + ring * 0.4;
    for (let at = 0; at < count; at += 1) {
      const angle = -Math.PI / 2 + turn + (at / count) * Math.PI * 2;
      seats.set(order[placed + at]!, { x: CENTRE_X + Math.cos(angle) * radius, y: CENTRE_Y + Math.sin(angle) * radius * 0.92 });
    }
    placed += count;
  }
  return seats;
}

const seatOf = (socket: number): Spot => {
  const end = socketAt(CENTRE, socket);
  const away = Math.hypot(end.x - CENTRE_X, end.y - CENTRE_Y) || 1;
  return { x: CENTRE_X + ((end.x - CENTRE_X) / away) * SEAT_REACH, y: CENTRE_Y + ((end.y - CENTRE_Y) / away) * SEAT_REACH };
};

const round = (at: Spot): Spot => ({ x: Math.round(at.x), y: Math.round(at.y) });

const progressOf = (since: number, time: number, span: number): number => Math.max(0, Math.min(1, (time - since) / span));

function describe(view: MindView, hover: Hover): string {
  const tired = view.curious ? '' : '. nobody has the mind for it now';
  const attached = view.idea.attached;
  if (hover === 'idea') return attached.length > 0 ? `an idea of ${attached.map(nameOf).join(' and ')}. click it to let go` : `an empty idea. click a neuron to start one${tired}`;
  if (typeof hover === 'string') {
    const idea = view.hypotheses.find((hypothesis) => `b${hypothesis.id}` === hover);
    if (!idea) return '';
    return idea.tryer >= 0 ? `an idea, ${PERSON_NAMES[idea.tryer] ?? 'someone'} is on it: ${idea.note}. click to look` : `an idea waiting for someone: ${idea.note}`;
  }
  if (typeof hover === 'number') {
    const state = view.idea.withered.includes(hover) ? ', it did not fit here' : attached.includes(hover) ? ', part of the idea' : '';
    return `${neuronOf(hover).label}${state}`;
  }
  if (attached.length > 0) return `pick what goes with ${attached.map(nameOf).join(' and ')}. a wrong pick withers and tires the mind${tired}`;
  return `click a neuron to start an idea${tired}`;
}

const regionStates = (view: MindView): RegionState[] =>
  REGIONS.map((region, index) => ({
    open: region.open || view.neurons.some((neuron) => neuronOf(neuron.index).region === index),
    waiting: view.ripe.some((result) => neuronOf(result).region === index),
  }));

const shownIn = (view: MindView, region: number): number[] => {
  const known = new Set(view.neurons.map((neuron) => neuron.index));
  const wanted = new Set<number>([...known].filter((index) => neuronOf(index).region === region));
  for (const result of view.ripe) {
    if (neuronOf(result).region !== region) continue;
    for (const parent of parentsOf(result)) if (known.has(parent)) wanted.add(parent);
  }
  return [...wanted];
};

export function BrainView({ host, onHover, active, onPick, style }: { host: MindHost; onHover: (text: string) => void; active: boolean; onPick: (region: number) => void; style?: React.CSSProperties }): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext('2d');
    if (!element || !ctx) return undefined;
    element.width = TREE_WIDTH;
    element.height = TREE_HEIGHT;
    let hover = -1;
    let shown = '';
    let handle = 0;
    const started = performance.now();

    const pointOf = (event: PointerEvent): Spot => {
      const rect = element.getBoundingClientRect();
      return { x: ((event.clientX - rect.left) * TREE_WIDTH) / rect.width, y: ((event.clientY - rect.top) * TREE_HEIGHT) / rect.height };
    };
    const onMove = (event: PointerEvent): void => {
      hover = regionAt(pointOf(event));
    };
    const onLeave = (): void => {
      hover = -1;
    };
    const onDown = (event: PointerEvent): void => {
      const view = host.view();
      const region = regionAt(pointOf(event));
      if (!view || region < 0 || !activeRef.current) return;
      if (regionStates(view)[region]?.open) onPick(region);
    };

    const frame = (): void => {
      handle = requestAnimationFrame(frame);
      if (!activeRef.current) return;
      const time = (performance.now() - started) / 1000;
      const view = host.view();
      ctx.globalAlpha = 1;
      drawBackdrop(ctx, time);
      if (!view) return;
      const states = regionStates(view);
      drawBrain(ctx, states, hover, time);
      let text = 'pick an area of the mind';
      if (hover >= 0) {
        const state = states[hover]!;
        const total = NEURONS.filter((neuron) => neuron.region === hover).length;
        const known = view.neurons.filter((neuron) => neuronOf(neuron.index).region === hover).length;
        const waiting = view.ripe.filter((result) => neuronOf(result).region === hover).length;
        text = !state.open ? `${labelOf(hover)}: not awake yet` : `${labelOf(hover)}: ${known} of ${total} known${waiting > 0 ? `, ${waiting} to work out` : ''}. click to enter`;
        caption(ctx, labelOf(hover), regionCentre(hover), state.open ? MIND.white : MIND.mute, -4);
      }
      element.style.cursor = hover >= 0 && states[hover]?.open ? 'pointer' : 'default';
      if (text !== shown) {
        shown = text;
        if (activeRef.current) onHover(text);
      }
    };

    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);
    frame();
    return () => {
      cancelAnimationFrame(handle);
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
    };
  }, [host, onHover, onPick]);

  return <canvas ref={canvas} className={`se-mind-layer ${active ? '' : 'is-far'}`} style={style} />;
}

export function MindTree({ host, onHover, region, active = true, since = Infinity, style }: { host: MindHost; onHover: (text: string) => void; region: number | null; active?: boolean; since?: number; style?: React.CSSProperties }): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const regionRef = useRef(region);
  regionRef.current = region;
  const activeRef = useRef(active);
  activeRef.current = active;
  const sinceRef = useRef(since);
  sinceRef.current = since;

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext('2d');
    if (!element || !ctx) return undefined;
    element.width = TREE_WIDTH;
    element.height = TREE_HEIGHT;

    const places = new Map<number, Spot>();
    const flashes = new Map<number, number>();
    let pending: Pending | null = null;
    let dying: Dying[] = [];
    let copies: Copy[] = [];
    let leaving: Leaving[] = [];
    let formed: Formed | null = null;
    let hover: Hover = null;
    const bubbles = new Map<number, Spot>();
    let bursts: Burst[] = [];
    let lastIdeas = -1;
    let lastFrame = 0;
    let shown = '';
    let handle = 0;
    const started = performance.now();
    const now = (): number => (performance.now() - started) / 1000;

    const pointOf = (event: PointerEvent): Spot => {
      const rect = element.getBoundingClientRect();
      return { x: ((event.clientX - rect.left) * TREE_WIDTH) / rect.width, y: ((event.clientY - rect.top) * TREE_HEIGHT) / rect.height };
    };

    const hitOf = (point: Spot): Hover => {
      if (Math.hypot(point.x - CENTRE_X, point.y - CENTRE_Y) < IDEA + 4) return 'idea';
      for (const [id, at] of bubbles) if (Math.hypot(at.x - point.x, at.y - point.y) < HIT_RADIUS) return `b${id}`;
      let found: number | null = null;
      let least = HIT_RADIUS;
      for (const [neuron, at] of places) {
        const away = Math.hypot(at.x - point.x, at.y - point.y);
        if (away < least) {
          least = away;
          found = neuron;
        }
      }
      return found;
    };

    const onDown = (event: PointerEvent): void => {
      const view = host.view();
      if (!view) return;
      const hit = hitOf(pointOf(event));
      if (event.button === 2 || hit === 'idea') {
        if (view.idea.attached.length > 0 && !pending) host.drop();
        return;
      }
      if (typeof hit === 'string') {
        const tryer = view.hypotheses.find((hypothesis) => `b${hypothesis.id}` === hit)?.tryer ?? -1;
        if (tryer >= 0) host.lookAt(tryer);
        return;
      }
      if (hit === null || pending || formed || !view.curious || view.idea.withered.includes(hit)) return;
      pending = { parent: hit, since: now(), held: view.idea.attached.length };
      host.pick(hit);
    };

    const onMove = (event: PointerEvent): void => {
      hover = hitOf(pointOf(event));
    };

    const onLeave = (): void => {
      hover = null;
    };

    const onMenu = (event: Event): void => event.preventDefault();

    const settle = (view: MindView, time: number): void => {
      const ideas = view.hypotheses.filter((hypothesis) => !hypothesis.order).length;
      if (lastIdeas >= 0 && ideas > lastIdeas) {
        const newest = view.hypotheses.filter((hypothesis) => !hypothesis.order).at(-1);
        if (newest) formed = { parents: newest.parents, since: time };
        pending = null;
      }
      lastIdeas = ideas;
      if (pending) {
        const parent = pending.parent;
        if (view.idea.withered.includes(parent)) {
          const socket = view.idea.attached.length;
          dying.push({ parent, socket, since: time, at: copies[socket]?.at ?? places.get(parent) ?? CENTRE });
          pending = null;
        } else if (view.idea.attached.length > pending.held) pending = null;
        else if (time - pending.since > PENDING_SECONDS) pending = null;
      }
      if (formed && time - formed.since > FORM_SECONDS) {
        formed = null;
        copies = [];
      }
      dying = dying.filter((one) => time - one.since < WITHER_SECONDS);
    };

    const frame = (): void => {
      handle = requestAnimationFrame(frame);
      if (!activeRef.current) return;
      const time = now();
      const step = Math.min(0.1, time - lastFrame);
      lastFrame = time;
      const view = host.view();
      ctx.globalAlpha = 1;
      drawBackdrop(ctx, time);
      if (!view) return;
      settle(view, time);

      const known = regionRef.current === null ? [] : shownIn(view, regionRef.current);
      for (const neuron of known) if (!places.has(neuron) && places.size > 0) flashes.set(neuron, time);
      const ideas = view.hypotheses.filter((hypothesis) => !hypothesis.order && hypothesis.state === State.Open && neuronOf(hypothesis.result).region === regionRef.current);
      const alive = new Set(ideas.map((idea) => idea.id));
      for (const [id, at] of bubbles) {
        if (alive.has(id)) continue;
        bursts.push({ at, since: time });
        bubbles.delete(id);
      }
      bursts = bursts.filter((burst) => time - burst.since < BURST_SECONDS);
      const origin = bursts.at(-1)?.at ?? CENTRE;
      const attached = formed ? [...formed.parents] : [...view.idea.attached];
      const seated = pending ? [...attached, pending.parent] : attached;
      const orders = new Map(view.neurons.map((neuron) => [neuron.index, neuron.order] as const));
      const targets = orbitOf(known, orders, time);
      for (const neuron of [...places.keys()]) if (!targets.has(neuron)) places.delete(neuron);
      const pull = 1 - Math.exp(-SETTLE * step);
      for (const [neuron, target] of targets) {
        const at = places.get(neuron) ?? { ...origin };
        places.set(neuron, { x: at.x + (target.x - at.x) * pull, y: at.y + (target.y - at.y) * pull });
      }

      ideas.forEach((idea, at) => {
        const angle = -Math.PI / 2 + time * BUBBLE_TURN + (at / ideas.length) * Math.PI * 2;
        const target = { x: CENTRE_X + Math.cos(angle) * BUBBLE_ORBIT, y: CENTRE_Y + Math.sin(angle) * BUBBLE_ORBIT * 0.92 };
        if (formed && !bubbles.has(idea.id)) return;
        const from = bubbles.get(idea.id) ?? { ...CENTRE };
        bubbles.set(idea.id, { x: from.x + (target.x - from.x) * pull, y: from.y + (target.y - from.y) * pull });
      });

      const next = seated.map((neuron, socket) => {
        const have = copies[socket];
        return have && have.neuron === neuron ? have : { neuron, at: { ...(places.get(neuron) ?? CENTRE) } };
      });
      for (const have of copies) if (!next.includes(have)) leaving.push({ ...have, since: time });
      copies = next;
      const merge = formed ? Math.min(1, Math.max(0, (time - formed.since - GROW_SECONDS - MERGE_HOLD) / MERGE_SECONDS)) : 0;
      copies.forEach((copy, socket) => {
        const seat = seatOf(socket);
        if (merge > 0) {
          const eased = merge * merge * (3 - 2 * merge);
          copy.at = { x: seat.x + (CENTRE_X - seat.x) * eased, y: seat.y + (CENTRE_Y - seat.y) * eased };
        } else copy.at = { x: copy.at.x + (seat.x - copy.at.x) * pull, y: copy.at.y + (seat.y - copy.at.y) * pull };
      });
      leaving = leaving.filter((one) => time - one.since < LEAVE_SECONDS);
      for (const one of leaving) {
        const home = places.get(one.neuron) ?? CENTRE;
        one.at = { x: one.at.x + (home.x - one.at.x) * pull, y: one.at.y + (home.y - one.at.y) * pull };
      }

      const flare = formed ? Math.max(0.3, merge) : 0;
      copies.forEach((copy, socket) => {
        const from = copy.at;
        if (merge > 0.8) return;
        const end = socketAt(CENTRE, socket);
        const growing = pending && socket === copies.length - 1 ? progressOf(pending.since, time, GROW_SECONDS) : 1;
        const start = rim(round(from), end, SOMA + 1);
        const to = { x: start.x + (end.x - start.x) * growing, y: start.y + (end.y - start.y) * growing };
        ctx.globalAlpha = formed ? 1 - merge : 1;
        drawFibre(ctx, start, to, 4 + socket * 3, formed ? 'pulsing' : 'fixed', time, growing >= 1);
      });
      for (const one of dying) {
        const from = one.at;
        const fade = progressOf(one.since, time, WITHER_SECONDS);
        ctx.globalAlpha = 1 - fade;
        drawFibre(ctx, socketAt(CENTRE, one.socket), round(from), 3 + fade * 8, 'dead', time, true);
      }
      ctx.globalAlpha = 1;
      drawIdea(ctx, CENTRE, formed ? formed.parents.length : view.idea.attached.length, time, flare);
      if (hover === 'idea') ringAround(ctx, CENTRE, IDEA + 7, MIND.light, 2);

      for (const [id, place] of bubbles) {
        const at = round(place);
        drawCell(ctx, at, 0.6 + 0.4 * Math.sin(time * 3 + id), null, time, QUESTION);
        if (hover === `b${id}`) ringAround(ctx, at, SOMA + 3, MIND.light, 2);
      }
      for (const burst of bursts) {
        const age = progressOf(burst.since, time, BURST_SECONDS);
        ctx.globalAlpha = 1 - age;
        ringAround(ctx, round(burst.at), SOMA + 2 + age * 26, MIND.white, 2);
        ctx.globalAlpha = 1;
      }

      for (const neuron of known) {
        const at = round(places.get(neuron) ?? CENTRE);
        const flash = flashes.get(neuron);
        if (flash !== undefined && time - flash < 1.2) ringAround(ctx, at, SOMA + 2 + (time - flash) * 22, MIND.white, 2);
        const withered = view.idea.withered.includes(neuron);
        const fresh = (orders.get(neuron) ?? 0) > sinceRef.current;
        ctx.globalAlpha = withered ? WITHERED_ALPHA : fresh ? 1 : OLD_ALPHA;
        drawCell(ctx, at, fresh ? 1.6 : 0.5, iconOf(neuronOf(neuron).id), time);
        ctx.globalAlpha = 1;
        if (fresh && !withered) ringAround(ctx, at, SOMA + 4 + Math.round(1 + Math.sin(time * 4 + neuron)), MIND.white, 3);
        if (withered) drawCross(ctx, at);
        if (hover === neuron) ringAround(ctx, at, SOMA + 3, MIND.light, 2);
      }
      for (const one of leaving) {
        ctx.globalAlpha = 1 - progressOf(one.since, time, LEAVE_SECONDS);
        drawCell(ctx, round(one.at), 1, iconOf(neuronOf(one.neuron).id), time);
      }
      ctx.globalAlpha = 1;
      for (const copy of copies) {
        ctx.globalAlpha = 1 - merge;
        drawCell(ctx, round(copy.at), 1, iconOf(neuronOf(copy.neuron).id), time);
        if (!formed) caption(ctx, neuronOf(copy.neuron).label, round(copy.at), MIND.bright);
        ctx.globalAlpha = 1;
      }
      for (const neuron of known) {
        const withered = view.idea.withered.includes(neuron);
        const fresh = (orders.get(neuron) ?? 0) > sinceRef.current;
        ctx.globalAlpha = withered ? WITHERED_ALPHA : fresh || hover === neuron ? 1 : OLD_ALPHA;
        caption(ctx, neuronOf(neuron).label, round(places.get(neuron) ?? CENTRE), fresh || hover === neuron ? MIND.white : MIND.light);
        ctx.globalAlpha = 1;
      }

      element.style.cursor = hover !== null ? 'pointer' : 'default';
      const text = describe(view, hover);
      if (text !== shown) {
        shown = text;
        if (activeRef.current) onHover(text);
      }
    };

    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);
    element.addEventListener('contextmenu', onMenu);
    frame();
    return () => {
      cancelAnimationFrame(handle);
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
      element.removeEventListener('contextmenu', onMenu);
    };
  }, [host, onHover]);

  return <canvas ref={canvas} className={`se-mind-layer ${active ? '' : 'is-near'}`} style={style} />;
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

export function MindPanel({ open, view, host, onClose, review: startReview = false, region: startRegion = null, since: fixedSince }: { open: boolean; view: MindView | null; host: MindHost; onClose: () => void; review?: boolean; region?: number | null; since?: number }): React.JSX.Element | null {
  const [hint, setHint] = useState('');
  const [review, setReview] = useState(startReview);
  const [region, setRegion] = useState<number | null>(startRegion);
  const [origin, setOrigin] = useState<Spot>(() => regionCentre(startRegion ?? 0));
  const [since, setSince] = useState(Infinity);
  const latest = useRef(view);
  latest.current = view;
  useEffect(() => {
    if (open) setSince(fixedSince ?? seen.value ?? mostOf(latest.current));
    else if (latest.current) seen.value = mostOf(latest.current);
  }, [open, fixedSince]);
  const enter = useCallback((next: number) => {
    setOrigin(regionCentre(next));
    setRegion(next);
    setHint('');
  }, []);
  const leave = useCallback(() => {
    if ((host.view()?.idea.attached.length ?? 0) > 0) host.drop();
    setRegion(null);
    setHint('');
  }, [host]);
  if (!open) return null;
  const stage = { transformOrigin: `${(origin.x / TREE_WIDTH) * 100}% ${(origin.y / TREE_HEIGHT) * 100}%` };

  const working = view?.hypotheses.filter((hypothesis) => hypothesis.state === State.Open) ?? [];
  const known = RECIPES.filter((recipe) => view?.neurons.some((neuron) => neuron.index === neuronIndex(recipe.result)));
  const waiting = view?.ripe.length ?? 0;
  const curiosity = view ? Math.round((1 - view.weariness) * 100) : 100;

  return (
    <div className="se-mind-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="se-board se-mind">
        <header className="se-person-head">
          <PixelHeading>mind</PixelHeading>
          <PixelText className="se-mind-curiosity">{view && !view.curious ? 'nobody has the mind for it' : `curiosity ${curiosity}%`}</PixelText>
          <button
            type="button"
            className="se-tile"
            title={review ? 'back to the idea in the middle' : 'see what has been worked out and how it connects'}
            onClick={() => {
              setHint('');
              setReview(!review);
            }}
          >
            <PixelText>{review ? 'mind' : 'review'}</PixelText>
          </button>
          {region !== null && !review ? (
            <button type="button" className="se-tile" title="back out to the whole mind" onClick={leave}>
              <PixelText>brain</PixelText>
            </button>
          ) : null}
          <button type="button" className="se-tile" onClick={onClose}>
            <PixelText>close</PixelText>
          </button>
        </header>
        {review ? (
          <ReviewTree host={host} onHover={setHint} />
        ) : (
          <div className="se-mind-stage">
            <BrainView host={host} onHover={setHint} active={region === null} onPick={enter} style={stage} />
            <MindTree host={host} onHover={setHint} region={region} active={region !== null} since={since} style={stage} />
          </div>
        )}
        <div className="se-mind-hint">
          <PixelBody>{hint || ' '}</PixelBody>
        </div>
        <div className="se-section">
          <PixelText>working on</PixelText>
        </div>
        <div className="se-mind-work">
          {working.length === 0 ? <PixelText>{waiting > 0 ? 'something could be worked out. pick neurons into the idea in the middle' : 'nothing to work out yet. the people need to meet more things'}</PixelText> : working.map((hypothesis) => <WorkLine key={hypothesis.id} hypothesis={hypothesis} host={host} />)}
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
