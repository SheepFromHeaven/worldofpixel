import type { GameMode } from '../sim/simulation.ts';
import type { Link } from './link.ts';
import { readSave } from './persist.ts';

export type { GameMode };

export const GAME_MODES: readonly GameMode[] = ['settle', 'discover'];

export interface Launch {
  slot: string;
  seed: number;
  mode: GameMode;
}

let chosen: Launch | null = null;

let connection: Promise<Link> | null = null;

export function launchWith(launch: Launch): void {
  if (chosen?.slot === launch.slot && connection) return;
  chosen = launch;
  const saved = readSave(launch.slot);
  connection = import('./link.ts').then(({ connect }) => connect({ seed: launch.seed, mode: saved?.mode ?? launch.mode, saved, carry: null }));
}

export function connected(): Promise<Link> {
  if (!connection) throw new Error('The game was opened before anything chose a world');
  return connection;
}

export function launched(): Launch {
  if (!chosen) throw new Error('The game was opened before anything chose a world');
  return chosen;
}
