import { useSyncExternalStore } from 'react';
import { townStage } from '../render/townStage.ts';
import { AreaSheet } from './AreaSheet.tsx';
import { game } from './game.ts';

/** The rail, wired to the town: the open area's inspector, docked to the right edge. */
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
