import { createRoot } from 'react-dom/client';
import { Lab } from './Lab.tsx';
import './lab.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(<Lab />);
