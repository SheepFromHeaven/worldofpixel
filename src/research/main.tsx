import { useCallback, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { MindView } from '../sim/mind/mind.ts';
import { State } from '../sim/mind/mind.ts';
import { NEURONS, Outcome, RECIPES, neuronIndex } from '../sim/mind/neurons.ts';
import { MindTree } from '../ui/MindPanel.tsx';
import type { MindHost } from '../ui/mindArt.ts';
import { layoutText, resetPlaces } from '../ui/mindLayout.ts';
import { PixelBody, PixelHeading, PixelText } from '../ui/pixel/Pixel.tsx';
import '../ui/styles/index.css';
import './research.css';

const everything = (): MindView => ({
  revision: 1,
  learned: 0,
  people: 2,
  neurons: NEURONS.map((neuron, index) => ({ index, x: neuron.angle, y: neuron.ring, holders: [2, 2], proven: true })),
  hypotheses: RECIPES.map((recipe, at) => ({
    id: at,
    a: neuronIndex(recipe.a),
    b: neuronIndex(recipe.b),
    state: recipe.outcome === Outcome.Success ? State.Success : State.Weak,
    result: neuronIndex(recipe.result),
    x: 0,
    y: 0,
    tryer: -1,
    partner: -1,
    order: false,
    note: recipe.title,
    age: 0,
  })),
  proven: [],
});

function Research(): React.JSX.Element {
  const view = useMemo(everything, []);
  const host = useMemo<MindHost>(() => ({ view: () => view, selected: () => -1, wonder: () => undefined, forget: () => undefined, lookAt: () => undefined }), [view]);
  const [hint, setHint] = useState('');
  const [text, setText] = useState(layoutText());
  const [note, setNote] = useState('');
  const moved = useCallback(() => setText(layoutText()), []);

  return (
    <div className="research se-stage">
      <header className="se-board research-head">
        <PixelHeading>research</PixelHeading>
        <PixelText>drag a neuron to move it, shift snaps to a ring, wheel zooms, drag the background pans</PixelText>
        <div className="research-tools">
          <button
            type="button"
            className="se-tile"
            onClick={() => {
              void navigator.clipboard.writeText(text).then(() => setNote('copied, paste it into src/sim/mind/layout.ts'));
            }}
          >
            <PixelText>copy layout</PixelText>
          </button>
          <button
            type="button"
            className="se-tile"
            onClick={() => {
              resetPlaces();
              setText(layoutText());
              setNote('reset, reload the page to see the stored layout');
            }}
          >
            <PixelText>reset</PixelText>
          </button>
        </div>
      </header>
      <main className="se-board research-main">
        <MindTree host={host} onHover={setHint} editing onMoved={moved} />
        <div className="research-hint">
          <PixelBody>{note || hint || ' '}</PixelBody>
        </div>
      </main>
      <aside className="se-board research-text">
        <PixelText>src/sim/mind/layout.ts</PixelText>
        <pre>{text}</pre>
      </aside>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Research />);
