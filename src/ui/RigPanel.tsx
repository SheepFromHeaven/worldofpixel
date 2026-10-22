import { useSyncExternalStore } from 'react';
import { townStage } from '../render/townStage.ts';
import { AreaSheet } from './AreaSheet.tsx';
import { game } from './game.ts';
import { HoldingSlab, RigSlab } from './RigSlab.tsx';

/** The slab, wired to the town. Everything it draws is in `RigSlab.tsx`. */
export function RigPanel(): React.JSX.Element | null {
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);
  const stage = townStage(hud.progress.buildings);
  const rig = hud.rig;

  if (hud.area) {
    return (
      <AreaSheet
        area={hud.area}
        stage={stage}
        hand={{
          open: (slot) => game.openSlot(slot),
          charge: (charge) => game.setCharge(charge),
          move: (methodId, slot, by) => game.moveLine(methodId, slot, by),
          place: (designId) => game.placeInOpenSlot(designId),
          raise: () => game.raiseOpenArea(),
          recipe: (slot, index) => game.setRecipe(slot, index),
          remove: (slot) => game.removeFromOpenArea(slot),
          close: () => game.hideBuilding(),
        }}
      />
    );
  }

  if (!rig) return hud.holding ? <HoldingSlab holding={hud.holding} stage={stage} onClose={() => game.hideBuilding()} /> : null;

  return (
    <RigSlab
      rig={rig}
      stage={stage}
      hand={{
        charge: (charge) => game.setCharge(charge),
        move: (methodId, by) => game.moveInQueue(methodId, by),
        close: () => game.hideBuilding(),
      }}
    />
  );
}
