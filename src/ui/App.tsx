import { BuildBar } from './BuildBar.tsx';
import { GameCanvas } from './GameCanvas.tsx';
import { Ledger } from './Ledger.tsx';
import { RigPanel } from './RigPanel.tsx';
import { TownPanel } from './TownPanel.tsx';

export function App(): React.JSX.Element {
  return (
    <div className="se-shell">
      <div className="se-stage">
        <GameCanvas />
        <Ledger />
        <RigPanel />
        <TownPanel />
        <BuildBar />
      </div>
    </div>
  );
}
