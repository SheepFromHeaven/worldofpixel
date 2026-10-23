import { GameCanvas } from './GameCanvas.tsx';
import { ShellPanels } from './ShellPanels.tsx';

export function App(): React.JSX.Element {
  return (
    <div className="se-shell">
      <div className="se-stage">
        <GameCanvas />
        <ShellPanels />
      </div>
    </div>
  );
}
