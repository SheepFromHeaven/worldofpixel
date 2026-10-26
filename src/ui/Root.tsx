import { useCallback, useState } from 'react';
import { SIZE_KEY, WORLD_SCALE } from '../sim/grid.ts';
import { LoadingScreen } from './LoadingScreen.tsx';
import { MainMenu } from './MainMenu.tsx';
import type { Launch } from './launch.ts';

type Screen =
  | { kind: 'menu' }
  | { kind: 'loading'; launch: Launch }
  | { kind: 'playing'; App: React.ComponentType };

const PENDING = 'scribble-empire.pending';

const pending = (): Launch | null => {
  try {
    const text = window.sessionStorage.getItem(PENDING);
    if (!text) return null;
    window.sessionStorage.removeItem(PENDING);
    const launch = JSON.parse(text) as Launch;
    return launch.size === WORLD_SCALE ? launch : null;
  } catch {
    return null;
  }
};

const resumed = pending();

function begin(launch: Launch, go: (launch: Launch) => void): void {
  if (launch.size === WORLD_SCALE) {
    go(launch);
    return;
  }
  window.sessionStorage.setItem(SIZE_KEY, String(launch.size));
  window.sessionStorage.setItem(PENDING, JSON.stringify(launch));
  window.location.reload();
}

export function Root(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>(resumed ? { kind: 'loading', launch: resumed } : { kind: 'menu' });

  const ready = useCallback((App: React.ComponentType) => setScreen({ kind: 'playing', App }), []);

  if (screen.kind === 'playing') return <screen.App />;
  if (screen.kind === 'loading') return <LoadingScreen launch={screen.launch} onReady={ready} />;
  return <MainMenu onLaunch={(launch) => begin(launch, (chosen) => setScreen({ kind: 'loading', launch: chosen }))} />;
}
