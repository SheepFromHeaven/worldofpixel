import { useSyncExternalStore } from 'react';
import { game, randomSeed } from './game.ts';
import { Bar, Clock, RailEdge, Strip } from './shell.tsx';

/** The shell's slots, wired to the game. They are mounted whatever is open and at every zoom. */
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
        bar={{ tool: hud.tool, fine: hud.detail === 'fine', towns: hud.settlementCount }}
        onTool={(tool) => game.setTool(tool)}
      />
    </>
  );
}
