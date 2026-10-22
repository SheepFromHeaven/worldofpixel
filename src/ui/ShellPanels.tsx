import { useSyncExternalStore } from 'react';
import { game, randomSeed } from './game.ts';
import { Bar, Clock, RailEdge, Strip } from './shell.tsx';

export function ShellPanels(): React.JSX.Element {
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);
  return (
    <>
      <RailEdge />
      <Strip strip={hud.strip} onDice={() => game.newWorld(randomSeed())} onOpen={() => game.toggleStats()} />
      <Clock
        clock={{ tick: hud.tick, playing: hud.playing, speed: hud.speed }}
        onPlaying={(playing) => game.setPlaying(playing)}
        onSpeed={(speed) => game.setSpeed(speed)}
      />
      <Bar
        bar={{ tool: hud.tool, fine: hud.detail === 'fine', towns: hud.settlementCount, reason: hud.hoverReason }}
        onTool={(tool) => game.setTool(tool)}
      />
    </>
  );
}
