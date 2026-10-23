import { createRoot } from 'react-dom/client';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

const root = createRoot(container);
root.render(<p className="se-raising">raising the world…</p>);

const painted = (): Promise<void> =>
  new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));

void painted()
  .then(() => import('./App.tsx'))
  .then(({ App }) => root.render(<App />));
