import { useSyncExternalStore } from 'react';
import { townStage } from '../render/townStage.ts';
import { game } from './game.ts';
import { RigSlab } from './RigSlab.tsx';

/** The slab, wired to the town. Everything it draws is in `RigSlab.tsx`. */
export function RigPanel(): React.JSX.Element | null {
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);
  const rig = hud.rig;
  if (!rig) return null;

  return (
    <RigSlab
      rig={rig}
      stage={townStage(hud.progress.buildings)}
      hand={{
        charge: (charge) => game.setCharge(charge),
        stop: (methodId, target) => game.setStop(methodId, target),
        move: (methodId, by) => game.moveInQueue(methodId, by),
      }}
    />
  );
}
