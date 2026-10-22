import { GameCanvas } from './GameCanvas.tsx';
import { Ledger } from './Ledger.tsx';
import { RigPanel } from './RigPanel.tsx';
import { ShellPanels } from './ShellPanels.tsx';
import { TownPanel } from './TownPanel.tsx';

export function App(): React.JSX.Element {
  return (
    <div className="se-shell">
      <div className="se-stage">
        <GameCanvas />
        <ShellPanels />
        <Ledger />
        <RigPanel />
        <TownPanel />
      </div>
    </div>
  );
}
