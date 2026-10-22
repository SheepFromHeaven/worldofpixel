import { createRoot } from 'react-dom/client';
import { startingSeed } from './seed.ts';
import './styles/index.css';
import { prepareWorld } from './worldLoader.ts';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

const root = createRoot(container);
root.render(<p className="se-raising">raising the world…</p>);

const seed = startingSeed();

void prepareWorld(seed).then(async ({ threaded }) => {
  const { App } = await import('./App.tsx');
  root.render(<App />);
  if (!threaded) console.warn('world built on the main thread: the worker could not start');
});
