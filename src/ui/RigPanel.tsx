import { useSyncExternalStore } from 'react';
import { townStage } from '../render/townStage.ts';
import { AreaSheet } from './AreaSheet.tsx';
import { game } from './game.ts';

export function RigPanel(): React.JSX.Element | null {
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);
  if (!hud.area) return null;

  return (
    <AreaSheet
      area={hud.area}
      stage={townStage(hud.progress.buildings)}
      hand={{
        open: (slot) => game.openSlot(slot),
        charge: (charge) => game.setCharge(charge),
        move: (recipeId, slot, by) => game.moveLine(recipeId, slot, by),
        place: (designId) => game.placeInOpenSlot(designId),
        raise: () => game.raiseOpenArea(),
        pool: (slot, index) => game.setPool(slot, index),
        remove: (slot) => game.removeFromOpenArea(slot),
        close: () => game.hideBuilding(),
      }}
    />
  );
}
