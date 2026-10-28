import { createRoot } from 'react-dom/client';
import '../ui/styles/index.css';
import { Zoo } from './Zoo.tsx';
import './zoo.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(<Zoo />);
