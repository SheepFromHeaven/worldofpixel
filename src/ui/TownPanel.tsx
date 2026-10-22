import { useSyncExternalStore } from 'react';
import { townStage } from '../render/townStage.ts';
import { game } from './game.ts';
import { TownSlab } from './TownSlab.tsx';

export function TownPanel(): React.JSX.Element | null {
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);
  if (!hud.statsOpen || !hud.town) return null;

  return <TownSlab town={hud.town} stage={townStage(hud.town.buildings)} />;
}
