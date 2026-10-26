import { createRoot } from 'react-dom/client';
import { Studio } from './Studio.tsx';
import './studio.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(<Studio />);
