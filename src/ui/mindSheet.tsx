import { createRoot } from 'react-dom/client';
import { Simulation } from '../sim/simulation.ts';
import { State } from '../sim/mind/mind.ts';
import { NEURON_COUNT, Outcome, RECIPES, neuronIndex } from '../sim/mind/neurons.ts';
import { MindPanel } from './MindPanel.tsx';
import type { MindHost } from './mindArt.ts';
import './styles/index.css';

const query = new URLSearchParams(location.search);
const seconds = Number(query.get('t') ?? 200);
const steps = (query.get('guess') ?? 'flint+flint,flint+stone,spark+kindling,ember+branch,stone+stone').split(',');
const select = Number(query.get('person') ?? -1);

const sim = new Simulation(20250214, 'settle', null);
const host: MindHost = {
  view: () => sim.mind.view(),
  selected: () => select,
  wonder: (a, b) => sim.apply({ kind: 'wonder', a, b }),
  forget: (id) => sim.apply({ kind: 'forget', id }),
  lookAt: () => undefined,
};

const state = { ready: false, time: 0, log: [] as string[] };
(window as unknown as { __mind: typeof state }).__mind = state;

function everything(): void {
  const { mind } = sim;
  for (let person = 0; person < sim.people.count; person += 1) for (let neuron = 0; neuron < NEURON_COUNT; neuron += 1) mind.learn(person, neuron, 2);
  for (const recipe of RECIPES) {
    const a = neuronIndex(recipe.a);
    const b = neuronIndex(recipe.b);
    mind.hypotheses.push({ id: 100 + mind.hypotheses.length, a, b, state: recipe.outcome === Outcome.Success ? State.Success : State.Weak, result: neuronIndex(recipe.result), tryer: -1, partner: -1, order: false, tile: -1, note: recipe.title, retryAt: 0 });
  }
  mind.hypotheses.push({ id: 200, a: neuronIndex('flint'), b: neuronIndex('branch'), state: State.Scar, result: -1, tryer: -1, partner: -1, order: false, tile: -1, note: 'nothing', retryAt: 0, age: 5 });
  mind.revision += 1;
}

function run(): void {
  let queued = 0;
  for (let tick = 0; tick * 0.1 < seconds; tick += 1) {
    sim.advance(0.1);
    state.time = sim.playTime;
    if (tick % 40 === 0 && queued < steps.length) {
      const [a, b] = steps[queued]!.split('+').map(neuronIndex) as [number, number];
      if (sim.mind.anyone(a) && sim.mind.anyone(b) && !sim.mind.tried(a, b)) {
        const error = sim.mind.wonder(a, b);
        state.log.push(`${steps[queued]}: ${error ?? 'ok'}`);
        queued += 1;
      }
    }
  }
  if (query.get('all')) everything();
  const root = createRoot(document.getElementById('root')!);
  root.render(<MindPanel open view={sim.mind.view()} host={host} onClose={() => undefined} />);
  setTimeout(() => {
    state.ready = true;
  }, 1500);
}

run();
