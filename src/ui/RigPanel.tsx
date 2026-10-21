import { useSyncExternalStore } from 'react';
import { townStage } from '../render/townStage.ts';
import { game } from './game.ts';
import { HoldingSlab, RigSlab } from './RigSlab.tsx';

/** The slab, wired to the town. Everything it draws is in `RigSlab.tsx`. */
export function RigPanel(): React.JSX.Element | null {
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);
  const stage = townStage(hud.progress.buildings);
  const rig = hud.rig;

  if (!rig) return hud.holding ? <HoldingSlab holding={hud.holding} stage={stage} /> : null;

  return (
    <RigSlab
      rig={rig}
      stage={stage}
      hand={{
        charge: (charge) => game.setCharge(charge),
        stop: (methodId, target) => game.setStop(methodId, target),
        move: (methodId, by) => game.moveInQueue(methodId, by),
      }}
    />
  );
}
