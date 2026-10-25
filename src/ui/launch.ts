export type GameMode = 'settle' | 'discover';

export const GAME_MODES: readonly GameMode[] = ['settle', 'discover'];

export interface Launch {
  slot: string;
  seed: number;
  mode: GameMode;
}

let chosen: Launch | null = null;

export function launchWith(launch: Launch): void {
  chosen = launch;
}

export function launched(): Launch {
  if (!chosen) throw new Error('The game was opened before anything chose a world');
  return chosen;
}
