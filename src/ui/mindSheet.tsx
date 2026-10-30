import { createRoot } from 'react-dom/client';
import { Simulation } from '../sim/simulation.ts';
import { NEURON_COUNT, neuronIndex } from '../sim/mind/neurons.ts';
import { MindPanel } from './MindPanel.tsx';
import type { MindHost } from './mindArt.ts';
import './styles/index.css';

const query = new URLSearchParams(location.search);
const seconds = Number(query.get('t') ?? 200);
const fibres = (query.get('fibres') ?? 'spark:flint,spark:stone,spark:flint,sharp:flint,ember:spark,ember:branch').split(',').filter((fibre) => fibre.includes(':'));
const focus = query.has('focus') ? neuronIndex(query.get('focus')!) : null;

const sim = new Simulation(20250214, 'settle', null);
const host: MindHost = {
  view: () => sim.mind.view(),
  attach: (cell, parent) => sim.apply({ kind: 'attach', cell, parent }),
  forget: (id) => sim.apply({ kind: 'forget', id }),
  lookAt: () => undefined,
};

const state = { ready: false, time: 0, log: [] as string[] };
(window as unknown as { __mind: typeof state }).__mind = state;

function run(): void {
  let queued = 0;
  for (let tick = 0; tick * 0.1 < seconds; tick += 1) {
    sim.advance(0.1);
    state.time = sim.playTime;
    if (tick % 30 === 0 && queued < fibres.length) {
      const [cell, parent] = fibres[queued]!.split(':').map(neuronIndex) as [number, number];
      if (sim.mind.stepOf(cell) !== 0 && sim.mind.knows(parent) && sim.mind.mindful()) {
        state.log.push(`${fibres[queued]}: ${sim.mind.attach(cell, parent) ?? 'ok'}`);
        queued += 1;
      }
    }
  }
  if (query.get('all')) for (let neuron = 0; neuron < NEURON_COUNT; neuron += 1) sim.mind.learn(neuron);
  const root = createRoot(document.getElementById('root')!);
  root.render(<MindPanel open view={sim.mind.view()} host={host} onClose={() => undefined} focusCell={focus} />);
  setTimeout(() => {
    state.ready = true;
  }, 1500);
}

run();
