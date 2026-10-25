import { useCallback, useState } from 'react';
import { LoadingScreen } from './LoadingScreen.tsx';
import { MainMenu } from './MainMenu.tsx';
import type { Launch } from './launch.ts';

type Screen =
  | { kind: 'menu' }
  | { kind: 'loading'; launch: Launch }
  | { kind: 'playing'; App: React.ComponentType };

export function Root(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });

  const ready = useCallback((App: React.ComponentType) => setScreen({ kind: 'playing', App }), []);

  if (screen.kind === 'playing') return <screen.App />;
  if (screen.kind === 'loading') return <LoadingScreen launch={screen.launch} onReady={ready} />;
  return <MainMenu onLaunch={(launch) => setScreen({ kind: 'loading', launch })} />;
}
