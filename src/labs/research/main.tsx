import { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { MindView } from '../../modules/mind/api.ts';
import { NEURONS, isRoot, neuronIndex, parentsOf } from '../../modules/mind/api.ts';
import { MindTree } from '../../ui/MindPanel.tsx';
import type { MindHost } from '../../ui/mindArt.ts';
import { PixelBody, PixelHeading, PixelText } from '../../ui/pixel/Pixel.tsx';
import '../../ui/styles/index.css';
import './research.css';

const ROOT_ORDER = ['flint', 'stone', 'branch', 'kindling', 'fibre', 'berries', 'egg', 'grubs', 'fish', 'rabbit'];

const MET_FIRST = 8;

const random = (seed: number): (() => number) => {
  let state = seed >>> 0 || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x6d2b79f5;
    return ((state ^ (state >>> 12)) >>> 0) / 0xffffffff;
  };
};

function orderOf(shuffle: number | null): string[] {
  const roll = shuffle === null ? null : random(shuffle);
  const known = new Set<number>();
  const order: string[] = [];
  const roots = ROOT_ORDER.map(neuronIndex).filter((index) => index >= 0 && isRoot(index));
  while (order.length < NEURONS.length) {
    const ready = NEURONS.map((_, index) => index).filter((index) => !known.has(index) && !isRoot(index) && parentsOf(index).every((parent) => known.has(parent)));
    const waiting = roots.filter((index) => !known.has(index));
    const early = order.length < MET_FIRST && waiting.length > 0;
    const choices = early ? waiting : roll ? [...ready, ...waiting] : ready.length > 0 ? ready : waiting;
    if (choices.length === 0) break;
    const pick = roll ? choices[Math.floor(roll() * choices.length)]! : choices[0]!;
    known.add(pick);
    order.push(NEURONS[pick]!.id);
  }
  return order;
}

function brainOf(order: readonly string[], steps: number): MindView {
  const known = new Set<number>();
  for (const id of order.slice(0, steps)) {
    const index = neuronIndex(id);
    if (index >= 0) known.add(index);
  }
  const neurons = [...known].sort((a, b) => a - b).map((index) => ({ index, order: order.indexOf(NEURONS[index]!.id) + 1 }));
  const ripe = NEURONS.map((_, index) => index).filter((index) => !known.has(index) && parentsOf(index).length > 0 && parentsOf(index).every((parent) => known.has(parent)));
  return { revision: steps, learned: 0, neurons, idea: { attached: [], withered: [] }, ripe, hypotheses: [], proven: [], curious: true, weariness: 0 };
}

function Research(): React.JSX.Element {
  const [order, setOrder] = useState(() => orderOf(null));
  const [steps, setSteps] = useState(order.length);
  const [hint, setHint] = useState('');
  const view = useMemo(() => brainOf(order, steps), [order, steps]);
  const current = useRef(view);
  current.current = view;
  const host = useMemo<MindHost>(() => ({ view: () => current.current, pick: () => undefined, drop: () => undefined, forget: () => undefined, lookAt: () => undefined }), []);

  return (
    <div className="research se-stage">
      <header className="se-board research-head">
        <PixelHeading>research</PixelHeading>
        <PixelText>{`the mind after an order of discovery. step ${steps} of ${order.length}: ${order[steps - 1] ?? 'nothing yet'}`}</PixelText>
        <div className="research-tools">
          <input className="research-steps" type="range" min={0} max={order.length} value={steps} onChange={(event) => setSteps(Number(event.currentTarget.value))} />
          <button
            type="button"
            className="se-tile"
            onClick={() => {
              const next = orderOf(Math.floor(Math.random() * 1e9));
              setOrder(next);
              setSteps(next.length);
            }}
          >
            <PixelText>shuffle</PixelText>
          </button>
        </div>
      </header>
      <main className="se-board research-main">
        <MindTree host={host} onHover={setHint} region={0} />
        <div className="research-hint">
          <PixelBody>{hint || ' '}</PixelBody>
        </div>
      </main>
      <aside className="se-board research-text">
        <PixelText>order of discovery, one id a line</PixelText>
        <textarea
          className="research-order"
          value={order.join('\n')}
          onChange={(event) => {
            const next = event.currentTarget.value.split(/[\s,]+/).filter((id) => id.length > 0);
            setOrder(next);
            setSteps(next.length);
          }}
        />
      </aside>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Research />);
