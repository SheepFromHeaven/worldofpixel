import { BuildBar } from './BuildBar.tsx';
import { ControlBar } from './ControlBar.tsx';
import { Designer } from './Designer.tsx';
import { GameCanvas } from './GameCanvas.tsx';
import { Ledger } from './Ledger.tsx';

export function App(): React.JSX.Element {
  return (
    <div className="se-shell">
      <ControlBar />
      <div className="se-stage">
        <GameCanvas />
        <Ledger />
        <BuildBar />
        <Designer />
      </div>
    </div>
  );
}
