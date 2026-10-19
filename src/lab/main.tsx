import { createRoot } from 'react-dom/client';
import { Hud } from './Hud.tsx';
import { Lab } from './Lab.tsx';
import './lab.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

/**
 * Two benches behind one entry, chosen by the hash: `/lab` for the sprites that go on the map,
 * `/lab#hud` for the tiles the building flow is laid out in. A hash and a reload rather than a
 * tab strip, because the HUD bench pulls in the game's own stylesheet — and two views that each
 * restyle the page cannot be mounted at once.
 */
const hud = window.location.hash === '#hud';
createRoot(container).render(hud ? <Hud /> : <Lab />);
window.addEventListener('hashchange', () => window.location.reload());
