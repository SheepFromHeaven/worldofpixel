import { createRoot } from 'react-dom/client';
import { startingSeed } from './seed.ts';
import { prepareWorld } from './worldLoader.ts';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

const root = createRoot(container);
root.render(<p className="se-raising">raising the world…</p>);

/**
 * The seed is settled first and written into the address bar, so that `game.ts` — which reads it
 * back when it is imported — opens the same map the worker just built.
 *
 * `App.tsx` is imported only after that. Importing it sooner pulls in `game.ts`, which builds its
 * world the moment it loads, and the whole point is that the world is already there by then.
 */
const seed = startingSeed();

void prepareWorld(seed).then(async ({ threaded }) => {
  const { App } = await import('./App.tsx');
  root.render(<App />);
  if (!threaded) console.warn('world built on the main thread: the worker could not start');
});
