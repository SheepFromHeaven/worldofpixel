import { useEffect } from 'react';
import { GameCanvas } from './GameCanvas.tsx';
import { ShellPanels } from './ShellPanels.tsx';
import { music } from './music.ts';

export function App(): React.JSX.Element {
  // A page may not make a sound before it has been touched, so the soundtrack waits for the
  // first click rather than trying at load and being refused.
  useEffect(() => music.armed(), []);

  return (
    <div className="se-shell">
      <div className="se-stage">
        <GameCanvas />
        <ShellPanels />
      </div>
    </div>
  );
}
