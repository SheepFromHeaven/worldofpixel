import { createRoot } from 'react-dom/client';
import { Hud } from './Hud.tsx';
import { Lab } from './Lab.tsx';
import './lab.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

const hud = window.location.hash === '#hud';
createRoot(container).render(hud ? <Hud /> : <Lab />);
window.addEventListener('hashchange', () => window.location.reload());
